/**
 * Two browsers, one real WebRTC call.
 *
 * This is the test that matters for stages 3–5: it does not mock the peer
 * connection. Chrome is launched with a fake capture device, both sides go
 * through onboarding, queue, match, and then the assertion reads
 * RTCPeerConnection.getStats() to confirm the media path is genuinely
 * peer-to-peer and that audio bytes actually moved.
 *
 *   npm run dev
 *   cd services/matchmaker && npm start
 *   npm i -D playwright && node e2e/two-person-call.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "./e2e/screenshots";

const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const errors = [];

async function onboard(name, band) {
  const ctx = await browser.newContext({
    viewport: { width: 480, height: 900 },
    permissions: ["microphone"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name}: ${m.text()}`);
  });

  await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
  await page.fill("#displayName", name);
  await page.getByText(band).click();
  await page.getByText("18 or over").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/rules");
  await page.getByRole("button", { name: /read these/i }).click();
  await page.waitForURL("**/cohort");
  await page.fill("#inviteCode", "PRACTICE");
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForURL("**/practice");

  console.log(`ok   ${name} onboarded`);
  return { ctx, page };
}

// Different level bands on purpose: adjacent bands must pair immediately.
const alice = await onboard("Alice", "Getting comfortable");
const bob = await onboard("Bob", "Fairly fluent");

await alice.page.goto(`${BASE}/practice/live`);
await alice.page.waitForSelector("text=/queue/i", { timeout: 10_000 });
console.log("ok   Alice is in the queue");
await alice.page.screenshot({ path: `${OUT}/s4-queue.png`, fullPage: true });

await bob.page.goto(`${BASE}/practice/live`);

// Both should be offered each other.
await Promise.all([
  alice.page.waitForSelector("text=Found someone", { timeout: 10_000 }),
  bob.page.waitForSelector("text=Found someone", { timeout: 10_000 }),
]);
console.log("ok   both sides were proposed a partner");
await alice.page.screenshot({ path: `${OUT}/s4-proposed.png`, fullPage: true });

// One ack is not a match.
await alice.page.getByRole("button", { name: /ready/i }).click();
const matchedEarly = await bob.page
  .waitForSelector("text=/are on in/", { timeout: 1200 })
  .then(() => true)
  .catch(() => false);
if (matchedEarly) throw new Error("matched on a single ack");
console.log("ok   one ack alone did not start the call");

await bob.page.getByRole("button", { name: /ready/i }).click();

await Promise.all([
  alice.page.waitForSelector("text=Topic", { timeout: 15_000 }),
  bob.page.waitForSelector("text=Topic", { timeout: 15_000 }),
]);
console.log("ok   both sides reached the call screen");

// The same topic on both sides, computed from the session id.
const topicOf = (page) =>
  page.locator("p.t-title-2").first().textContent();
const [aliceTopic, bobTopic] = await Promise.all([
  topicOf(alice.page),
  topicOf(bob.page),
]);
if (aliceTopic !== bobTopic) {
  throw new Error(`topics differ:\n  ${aliceTopic}\n  ${bobTopic}`);
}
console.log(`ok   same topic both sides: "${aliceTopic.trim()}"`);

/*
 * Poll from Node rather than with waitForFunction: getStats() is async, and
 * waitForFunction treats the returned Promise as a truthy result and resolves
 * on the first tick with nothing useful in it.
 */
async function readPeerStats(page) {
  return page.evaluate(async () => {
    const peer = window.__onairPeer;
    if (!peer || peer.connectionState !== "connected") return null;

    const report = await peer.getStats();
    let pair = null;
    let inbound = null;
    for (const entry of report.values()) {
      if (entry.type === "candidate-pair" && entry.state === "succeeded") {
        pair = entry;
      }
      if (entry.type === "inbound-rtp" && entry.kind === "audio") {
        inbound = entry;
      }
    }
    if (!pair) return null;

    const local = report.get(pair.localCandidateId);
    return {
      connectionState: peer.connectionState,
      candidateType: local?.candidateType ?? "unknown",
      bytesReceived: inbound?.bytesReceived ?? 0,
      packetsReceived: inbound?.packetsReceived ?? 0,
    };
  });
}

let result = null;
const deadline = Date.now() + 25_000;
while (Date.now() < deadline) {
  result = await readPeerStats(alice.page);
  // Wait for real audio, not just a connected state.
  if (result && result.bytesReceived > 0) break;
  await new Promise((r) => setTimeout(r, 500));
}
if (!result) throw new Error("peer connection never reached 'connected'");
if (result.bytesReceived === 0) throw new Error("connected but no audio arrived");
console.log(
  `ok   peer connection: state=${result.connectionState} ` +
    `candidate=${result.candidateType} ` +
    `bytesReceived=${result.bytesReceived}`,
);

if (result.candidateType === "relay") {
  throw new Error("expected a direct peer-to-peer path on localhost, got a relay");
}

await alice.page.screenshot({ path: `${OUT}/s5-call.png`, fullPage: true });
await bob.page.screenshot({ path: `${OUT}/s5-call-partner.png`, fullPage: true });

// Hanging up tells the other side rather than leaving them on a dead call.
await alice.page.getByRole("button", { name: "Leave" }).click();
await alice.page.getByRole("button", { name: /End it/i }).click();
await bob.page.waitForSelector("text=/queue/i", { timeout: 10_000 });
console.log("ok   the other side was returned to the queue on hang-up");

console.log(`\nconsole/page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 6).join("\n"));

await browser.close();
process.exit(errors.length ? 1 : 0);
