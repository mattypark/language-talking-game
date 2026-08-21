import { chromium } from "playwright";
const BASE = process.env.ONAIR_BASE ?? "http://localhost:3000";
const OUT = "./e2e/screenshots";

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, permissions: ["microphone"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${BASE}/join`, { waitUntil: "networkidle" });
await page.fill("#displayName", "Solo");
await page.getByRole("button", { name: /^English/ }).click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByText("Getting comfortable").click();
await page.getByRole("button", { name: "Continue" }).click();
await page.getByText("18 or over").click();
await page.getByRole("button", { name: "Start practising" }).click();
await page.waitForURL("**/rules");
await page.getByRole("button", { name: /read these/i }).click();
await page.waitForURL("**/cohort");
await page.fill("#inviteCode", "PRACTICE");
await page.getByRole("button", { name: "Join", exact: true }).click();
await page.waitForURL("**/practice");
console.log("ok   onboarded");

await page.goto(`${BASE}/practice/ai`);
await page.waitForSelector("text=Nobody free right now", { timeout: 10000 });
console.log("ok   AI partner offered, labelled honestly");
await page.screenshot({ path: `${OUT}/s11-ai-intro.png`, fullPage: true });

await page.getByRole("button", { name: "Start talking" }).click();
await page.waitForSelector("text=AI partner", { timeout: 10000 });
console.log("ok   session started");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/s11-ai-call.png`, fullPage: true });

for (let i = 0; i < 4; i += 1) {
  await page.getByRole("button", { name: /answered/i }).click();
  await page.waitForTimeout(400);
}
console.log("ok   walked through the turns");

await page.getByRole("button", { name: "Finish" }).click();
await page.waitForURL("**/practice/report/**", { timeout: 15000 });
await page.waitForSelector("text=You spoke.", { timeout: 40000 });
console.log("ok   AI session produced a report through the same pipeline");

console.log(`\nconsole/page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 4).join("\n"));
await browser.close();
