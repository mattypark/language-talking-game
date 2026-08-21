/**
 * The short way in: welcome console -> queue, with no account and no store.
 *
 * This is the path a stranger arriving at a deployed link actually takes, and
 * the one thing it must prove is that nothing between the landing page and a
 * live queue needs a database. A guest is a signed cookie; the room is a
 * constant; the queue is the matchmaker. If this passes with no keys set, the
 * deployment works.
 *
 *   npm run dev
 *   cd services/matchmaker && npm start
 *   node e2e/guest-launch.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.ONAIR_BASE ?? "http://localhost:3000";
const OUT = "./e2e/screenshots";

const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});

const context = await browser.newContext({
  viewport: { width: 480, height: 900 },
  permissions: ["microphone"],
});
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  /*
   * The walkthrough film is deliberately absent until someone records one, and
   * a missing resource reports its URL in the message LOCATION rather than in
   * the text — which is always the same generic 404 sentence.
   */
  const source = m.location()?.url ?? "";
  if (m.type() === "error" && !source.includes("demo.mp4")) {
    errors.push(`${m.text()} ${source}`.trim());
  }
});

async function step(name, run) {
  await run();
  console.log(`ok   ${name}`);
}

await step("welcome renders the console", async () => {
  await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle" });
  await page.waitForSelector(".console__label");
});

await step("the matchmaker readout is real", async () => {
  // "ready" only appears once /api/matchmaker/wake has actually answered.
  await page.waitForSelector("text=ready", { timeout: 65_000 });
});

await step("the mic meter runs before anything is submitted", async () => {
  await page.getByRole("button", { name: /test my mic/i }).click();
  await page.waitForSelector("text=/if the bars move/i", { timeout: 10_000 });
});

await step("going on air needs the age band and nothing else", async () => {
  const go = page.getByRole("button", { name: /go on air/i });
  if (!(await go.isDisabled())) {
    throw new Error("the button was enabled before an age band was chosen");
  }
  await page.getByRole("button", { name: "18 or over" }).click();
  await page.screenshot({ path: `${OUT}/guest-console.png`, fullPage: true });
  await go.click();
});

await step("the guest lands in the queue", async () => {
  await page.waitForURL("**/practice/live", { timeout: 15_000 });
  await page.waitForSelector("text=/queue/i", { timeout: 15_000 });
  await page.screenshot({ path: `${OUT}/guest-queue.png`, fullPage: true });
});

await step("a guest is not recorded", async () => {
  // The session is never registered, because nothing is being recorded to
  // upload — that is what makes this path work with no store at all.
  const registered = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .some((entry) => entry.name.includes("/api/sessions")),
  );
  if (registered) throw new Error("a guest call registered a session");
});

if (errors.length > 0) {
  console.error("\npage errors:");
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
}

await browser.close();
console.log("\ndone");
