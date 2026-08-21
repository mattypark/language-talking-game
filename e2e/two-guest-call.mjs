/**
 * Two guests, one call, no database.
 *
 * The deployed product's main path: nobody signs up, nothing is written, and
 * two strangers still end up on a real peer connection. It also covers the
 * end of that call, which is the one place a guest differs — there is no
 * report to be sent to, so the call ends on a screen rather than a redirect.
 *
 *   npm run dev
 *   cd services/matchmaker && npm start
 *   node e2e/two-guest-call.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.ONAIR_BASE ?? "http://localhost:3000";
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

async function launchGuest(name) {
  const ctx = await browser.newContext({
    viewport: { width: 480, height: 900 },
    permissions: ["microphone"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => {
    const source = m.location()?.url ?? "";
    if (m.type() === "error" && !source.includes("demo.mp4")) {
      errors.push(`${name}: ${m.text()}`);
    }
  });

  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await page.fill("#displayName", name);
  await page.getByRole("button", { name: "18 or over" }).click();
  await page.getByRole("button", { name: /go on air/i }).click();
  await page.waitForURL("**/practice/live", { timeout: 15_000 });

  console.log(`ok   ${name} went on air with no account`);
  return page;
}

const ada = await launchGuest("Ada");
const raj = await launchGuest("Raj");

await Promise.all([
  ada.waitForSelector("text=Match found", { timeout: 20_000 }),
  raj.waitForSelector("text=Match found", { timeout: 20_000 }),
]);
console.log("ok   two guests were proposed to each other");

await ada.getByRole("button", { name: /ready/i }).click();
await raj.getByRole("button", { name: /ready/i }).click();

await Promise.all([
  ada.waitForSelector("button:has-text('Mute')", { timeout: 25_000 }),
  raj.waitForSelector("button:has-text('Mute')", { timeout: 25_000 }),
]);
console.log("ok   both guests reached a live call");
await ada.screenshot({ path: `${OUT}/guest-call.png`, fullPage: true });

// Nothing is registered, because nothing is being recorded to upload.
const wroteAnything = await ada.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .some((entry) => entry.name.includes("/api/sessions")),
);
if (wroteAnything) throw new Error("a guest call touched the session store");
console.log("ok   no session was written for a guest call");

// Ada hangs up: confirm, then leave.
await ada.getByRole("button", { name: "Leave" }).click();
await ada.getByRole("button", { name: /end it for both/i }).click();

await ada.waitForSelector("text=Off air", { timeout: 15_000 });
const url = new URL(ada.url());
if (url.pathname.includes("/report/")) {
  throw new Error("a guest was sent to a report that cannot exist");
}
console.log("ok   the call ended on a screen, not on an empty report");
await ada.screenshot({ path: `${OUT}/guest-off-air.png`, fullPage: true });

// And the loop closes: another call, straight back into the queue.
await ada.getByRole("button", { name: /another call/i }).click();
await ada.waitForSelector("text=/queue/i", { timeout: 15_000 });
console.log("ok   'another call' puts them straight back in the queue");

if (errors.length > 0) {
  console.error("\npage errors:");
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
}

await browser.close();
console.log("\ndone");
