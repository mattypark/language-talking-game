/**
 * Onboarding flow, driven end to end against a running dev server.
 *
 * The step that matters is the age-band refusal: an adult must not be able to
 * join the under-18 group even by typing its code directly. That rule is the
 * one this product cannot afford to get wrong, so it has a test rather than a
 * comment.
 *
 *   npm run dev
 *   npm i -D playwright && node e2e/onboarding.mjs
 *
 * Playwright is not an app dependency — this is a check you run.
 */
import { chromium } from "playwright";

const OUT = "./e2e/screenshots";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const step = async (label, fn) => {
  await fn();
  console.log(`ok   ${label}  -> ${new URL(page.url()).pathname}`);
};

await step("home", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
});

await step("join form", async () => {
  await page.getByRole("button", { name: "Set yourself up" }).click();
  await page.waitForURL("**/join");
});

await step("submit profile as adult", async () => {
  await page.fill("#displayName", "Matthew");
  await page.getByText("Fairly fluent").click();
  await page.getByText("18 or over").click();
  await page.selectOption("#firstLanguage", "Korean");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/rules");
});
await page.screenshot({ path: `${OUT}/s2-rules.png`, fullPage: true });

await step("accept rules", async () => {
  await page.getByRole("button", { name: /read these/i }).click();
  await page.waitForURL("**/cohort");
});
await page.screenshot({ path: `${OUT}/s2-cohort.png`, fullPage: true });

// The load-bearing safety rule: an adult must not be able to join the
// under-18 group, even by typing its code directly.
await step("SCHOOL code rejected for an adult", async () => {
  await page.fill("#inviteCode", "SCHOOL");
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForSelector('.form-error');
  const message = await page.locator('.form-error').textContent();
  if (!/different age range/i.test(message ?? "")) {
    throw new Error(`Expected an age-band refusal, got: ${message}`);
  }
  console.log(`     refusal: "${message.trim()}"`);
});

await step("lowercase code accepted", async () => {
  await page.fill("#inviteCode", "practice");
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForURL("**/practice");
});
await page.screenshot({ path: `${OUT}/s2-practice.png`, fullPage: true });

await step("session survives a reload", async () => {
  await page.goto(BASE + "/practice", { waitUntil: "networkidle" });
  if (!page.url().includes("/practice")) throw new Error("bounced out of /practice");
});

await step("onboarding gate redirects a fresh visitor", async () => {
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(BASE + "/practice", { waitUntil: "networkidle" });
  if (!freshPage.url().includes("/join")) {
    throw new Error(`Expected a redirect to /join, landed on ${freshPage.url()}`);
  }
  await fresh.close();
});

await step("sign out", async () => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(BASE + "/");
});

console.log(`\nconsole/page errors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 5).join("\n"));

await browser.close();
process.exit(errors.length ? 1 : 0);
