/**
 * Landing checks: breakpoints, overflow, and that the hero's type actually
 * reads against whatever is behind it.
 *
 *   npm run dev
 *   npm i -D playwright && node e2e/landing.mjs
 */
import { chromium } from "playwright";

const OUT = "./e2e/screenshots";
const BASE = process.env.ONAIR_BASE ?? "http://localhost:3000";

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

for (const [name, w, h] of [
  ["1440", 1440, 900],
  ["768", 768, 1000],
  ["320", 320, 800],
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => {
    // The hero HEADs /hero.jpg to see if a photo exists; a 404 is the answer,
    // not a fault.
    if (m.type() === "error" && !m.text().includes("404")) {
      errors.push(`${name}: ${m.text()}`);
    }
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  await page.screenshot({ path: `${OUT}/hero-${name}.png` });
  console.log(`${name}  overflowPx=${overflow}`);
  if (overflow > 0) throw new Error(`${name} scrolls sideways`);
  await ctx.close();
}

// Cream on the stage has to clear 4.5:1 like any other text.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });

const ratio = await page.evaluate(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
  const rgb = (color) => {
    ctx2d.clearRect(0, 0, 1, 1);
    ctx2d.fillStyle = color;
    ctx2d.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx2d.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]) => 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const read = (token) => {
    probe.style.color = `var(${token})`;
    return rgb(getComputedStyle(probe).color);
  };
  const a = lum(read("--stage-ink"));
  const b = lum(read("--stage"));
  probe.remove();
  return (
    Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100
  );
});
console.log(`cream on stage: ${ratio}:1`);
if (ratio < 4.5) throw new Error("hero type does not meet contrast");

const navFont = await page.evaluate(() => {
  const link = document.querySelector(".stage__nav-link");
  const style = getComputedStyle(link);
  return `${style.fontFamily.split(",")[0]} ${style.fontWeight}`;
});
console.log(`nav type: ${navFont}`);

console.log(`\nerrors: ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 4).join("\n"));
await browser.close();
process.exit(errors.length ? 1 : 0);
