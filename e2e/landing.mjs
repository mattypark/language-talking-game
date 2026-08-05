import { chromium } from "playwright";
const OUT = "./e2e/screenshots";
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
for (const [name, w, h] of [["landing-1440", 1440, 1200], ["landing-768", 768, 1200], ["landing-320", 320, 1200]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${OUT}/s12-${name}.png`, fullPage: true });
  console.log(`${name}  overflowPx=${overflow}`);
  await ctx.close();
}
// The signature animation must resolve, not stall mid-way.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const letterOpacity = await page.evaluate(() => {
  const el = document.querySelector("[data-letter]");
  return el ? Number(getComputedStyle(el).opacity) : -1;
});
console.log(`wordmark resolved: opacity=${letterOpacity}`);
if (letterOpacity < 0.99) throw new Error("signature animation did not finish");

// Reduced motion must land on the destination immediately.
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const rmPage = await rm.newPage();
await rmPage.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await rmPage.waitForTimeout(600);
const rmOpacity = await rmPage.evaluate(() => Number(getComputedStyle(document.querySelector("[data-letter]")).opacity));
console.log(`reduced motion: wordmark opacity=${rmOpacity} (should already be 1)`);
if (rmOpacity < 0.99) throw new Error("reduced motion did not skip to the end state");

console.log(`\nconsole/page errors: ${errors.length}`);
await browser.close();
