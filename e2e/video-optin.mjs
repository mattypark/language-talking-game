import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "./e2e/screenshots";

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const errors = [];
async function onboard(name, band) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 950 }, permissions: ["microphone", "camera"] });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(`${name}: ${e}`));
  page.on("console", m => { if (m.type()==="error") errors.push(`${name}: ${m.text()}`); if (m.text().includes("[onair]")) console.log(`     TRACE ${name}: ${m.text()}`); });
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
  return { ctx, page };
}
const a = await onboard("Ana", "Getting comfortable");
const b = await onboard("Ben", "Fairly fluent");

await a.page.goto(`${BASE}/practice/live?language=en&topic=any`);
await a.page.waitForSelector("text=/queue/i");
await b.page.goto(`${BASE}/practice/live?language=en&topic=any`);
await Promise.all([
  a.page.waitForSelector("text=Found someone"),
  b.page.waitForSelector("text=Found someone"),
]);
await a.page.getByRole("button", { name: /ready/i }).click();
await b.page.getByRole("button", { name: /ready/i }).click();
await Promise.all([
  a.page.waitForSelector("text=Topic", { timeout: 20000 }),
  b.page.waitForSelector("text=Topic", { timeout: 20000 }),
]);
await a.page.waitForSelector("button:has-text('Mute')", { timeout: 20000 });
console.log("ok   call is live, voice only");

const videoTilesA = await a.page.locator("video").count();
console.log(`ok   no camera tiles before anyone asks (video elements: ${videoTilesA} = 1 audio only)`);

// Ana asks. Ben must be prompted, not switched on.
await a.page.getByRole("button", { name: "Video", exact: true }).click();
await b.page.waitForSelector("text=wants to turn cameras on", { timeout: 10000 });
console.log("ok   partner is asked, not switched on");

const benCamsBefore = await b.page.evaluate(() => {
  const peer = window.__onairPeer;
  return peer ? peer.getSenders().filter(s => s.track?.kind === "video").length : -1;
});
if (benCamsBefore !== 0) throw new Error(`camera on before consent (${benCamsBefore})`);
console.log("ok   no camera track exists before consent");

await b.page.getByRole("button", { name: "Turn my camera on" }).click();

// Both should end up sending AND receiving video.
async function videoStats(page) {
  return page.evaluate(async () => {
    const peer = window.__onairPeer;
    if (!peer) return null;
    const sending = peer.getSenders().filter(s => s.track?.kind === "video").length;
    const report = await peer.getStats();
    let inboundVideo = 0;
    for (const e of report.values()) {
      if (e.type === "inbound-rtp" && e.kind === "video") inboundVideo = e.bytesReceived ?? 0;
    }
    return { sending, inboundVideo, state: peer.connectionState };
  });
}
let sa = null, sb = null;
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  sa = await videoStats(a.page); sb = await videoStats(b.page);
  if (sa?.sending && sb?.sending && sa.inboundVideo > 0 && sb.inboundVideo > 0) break;
  await new Promise(r => setTimeout(r, 1000));
}
console.log(`     Ana: sending=${sa.sending} inboundVideoBytes=${sa.inboundVideo}`);
console.log(`     Ben: sending=${sb.sending} inboundVideoBytes=${sb.inboundVideo}`);
for (const [n, pg] of [["Ana", a.page], ["Ben", b.page]]) {
  const d = await pg.evaluate(() => {
    const peer = window.__onairPeer;
    return {
      signalingState: peer.signalingState,
      transceivers: peer.getTransceivers().map(t => ({
        mid: t.mid,
        kind: t.receiver.track?.kind,
        direction: t.direction,
        currentDirection: t.currentDirection,
        senderTrack: t.sender.track?.kind ?? null,
      })),
    };
  });
  console.log(`--- ${n}`, JSON.stringify(d));
}
if (!sa.sending || !sb.sending) throw new Error("a camera track never got added");
if (sa.inboundVideo === 0 || sb.inboundVideo === 0) throw new Error("video negotiated but no frames arrived");
console.log("ok   renegotiated on the live call and real video flowed both ways");
await a.page.screenshot({ path: `${OUT}/s14-video.png`, fullPage: true });

// Either side may drop their camera unilaterally.
await a.page.getByRole("button", { name: "Stop video" }).click();
await new Promise(r => setTimeout(r, 2500));
const after = await videoStats(a.page);
if (after.sending !== 0) throw new Error("camera did not stop");
console.log("ok   one side dropped its camera without asking");
console.log(`\nerrors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0,5).join("\n"));
await browser.close();
process.exit(errors.length ? 1 : 0);
