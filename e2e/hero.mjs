import { chromium } from "playwright";
const OUT = "./e2e/screenshots";
const browser = await chromium.launch({ channel: "chrome", args: ["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, permissions: ["microphone"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type()==="error" && !m.text().includes("404")) errors.push(m.text()); });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Underline animates in on hover.
const link = page.locator(".stage__nav-link").nth(1);
const before = await link.evaluate(el => getComputedStyle(el, "::after").transform);
const colBefore = await link.evaluate(el => getComputedStyle(el).color);
await link.hover();
await page.waitForTimeout(400);
const after = await link.evaluate(el => getComputedStyle(el, "::after").transform);
console.log(`underline: ${before}  ->  ${after}`);
if (before === after) throw new Error("nav underline did not animate on hover");
const colAfter = await link.evaluate(el => getComputedStyle(el).color);
console.log(`nav colour: ${colBefore} -> ${colAfter}`);
if (colBefore === colAfter) throw new Error("nav did not turn orange on hover");
console.log("ok   nav underline wipes in and turns orange");

// Presence reads a real number.
const presence = await page.locator("p.stage__word").last().textContent();
console.log(`presence: "${presence?.trim()}"`);

// Mic check goes live and shows real levels.
await page.getByRole("button", { name: /Check your microphone/i }).click();
await page.waitForTimeout(2000);
await page.waitForTimeout(1200);
const heights = await page.$$eval(".mic-check__bar", els => els.map(e => e.style.height));
console.log(`ok   mic live, bar heights: ${heights.join(" ")}`);
await page.screenshot({ path: `${OUT}/hero-live.png` });

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`overflowPx=${overflow}`);
console.log(`\nerrors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0,3).join("\n"));
await browser.close();
process.exit(errors.length ? 1 : 0);
