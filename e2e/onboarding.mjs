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
/*
 * Two components deliberately probe for optional files with a HEAD request and
 * render an honest empty state when they 404 — the hero photograph and the
 * walkthrough film. Chrome logs every 404 as a console error, so without this
 * the run fails on the app working exactly as designed. Anything else still
 * counts.
 */
const EXPECTED_404 = ["/hero.jpg", "/demo.mp4", "/demo-poster.jpg"];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  /*
   * "Failed to load resource" does not name the URL, so it cannot be filtered
   * and cannot be acted on. The response handler below reports the same
   * failures WITH the URL, so this one is pure noise.
   */
  const text = m.text();
  if (text.startsWith("Failed to load resource")) return;
  errors.push(text);
});

page.on("response", (response) => {
  if (response.status() < 400) return;
  if (EXPECTED_404.some((path) => response.url().endsWith(path))) return;
  errors.push(`HTTP ${response.status()} ${response.url()}`);
});

const step = async (label, fn) => {
  await fn();
  console.log(`ok   ${label}  -> ${new URL(page.url()).pathname}`);
};

await step("home", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
});

await step("welcome", async () => {
  await page.getByRole("link", { name: "Join a room" }).first().click();
  await page.waitForURL("**/welcome");
});

await step("join form", async () => {
  await page.getByRole("button", { name: "Set yourself up" }).click();
  await page.waitForURL("**/join");
});

// Three steps: name + language, then level, then age band.
await step("submit profile as adult", async () => {
  await page.fill("#displayName", "Matthew");
  await page.getByRole("button", { name: /^English/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Fairly fluent").click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("18 or over").click();
  await page.getByRole("button", { name: "Start practising" }).click();
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
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.waitForSelector('.form-error');
  const message = await page.locator('.form-error').textContent();
  if (!/different age range/i.test(message ?? "")) {
    throw new Error(`Expected an age-band refusal, got: ${message}`);
  }
  console.log(`     refusal: "${message.trim()}"`);
});

await step("lowercase code accepted", async () => {
  await page.fill("#inviteCode", "practice");
  await page.getByRole("button", { name: "Join", exact: true }).click();
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
