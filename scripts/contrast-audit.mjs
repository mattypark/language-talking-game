/**
 * Contrast audit.
 *
 * Measures the RENDERED contrast of every token pair that actually appears in
 * the product, rather than trusting arithmetic on the OKLCH values. It caught
 * a real failure once already: the original clementine accent was 3.02:1 under
 * a white button label, which is a ship blocker.
 *
 * Requires a dev server on :3000 and Playwright:
 *
 *   npm run dev
 *   npm i -D playwright && node scripts/contrast-audit.mjs
 *
 * Playwright is intentionally NOT a dependency of the app — this is a check you
 * run, not something the product ships.
 *
 * Exits non-zero on any failure, so it can gate a release.
 */
import { chromium } from "playwright";

const PAIRS = [
  ["--ink", "--canvas", 4.5, "body text on page"],
  ["--ink", "--surface", 4.5, "body text on card"],
  ["--ink-muted", "--canvas", 4.5, "secondary body on page"],
  ["--ink-muted", "--surface", 4.5, "secondary body on card"],
  ["--ink-muted", "--sunken", 4.5, "secondary body in a well"],
  ["--ink-subtle", "--canvas", 3.0, "disabled / decorative only — never real copy"],
  ["--accent-ink", "--canvas", 4.5, "accent AS TEXT"],
  ["--accent-ink", "--accent-tint", 4.5, "accent text on its tint"],
  ["--live-ink", "--live-tint", 4.5, "live badge text"],
  ["--partner-ink", "--partner-tint", 4.5, "partner badge text"],
  ["--warn-ink", "--warn-tint", 4.5, "warn badge text"],
  ["--on-accent", "--accent", 4.5, "label on primary button"],
  ["--on-accent", "--danger", 4.5, "label on danger button"],
  ["--accent", "--canvas", 3.0, "primary button fill vs page"],
  ["--accent-bright", "--canvas", 3.0, "topic rail / mark vs page"],
  ["--accent-bright", "--surface", 3.0, "topic rail / waveform vs card"],
  ["--live", "--surface", 3.0, "live dot vs card"],
  ["--partner", "--surface", 3.0, "partner ring vs card"],
  ["--danger", "--surface", 3.0, "danger vs card"],
  ["--warn", "--surface", 3.0, "warn vs card"],
  ["--hairline", "--surface", 1.0, "hairline — decorative, no minimum"],
  // The empty score track is a container, not the meter's value: the filled
  // portion and the printed number both carry the reading, so 1.4.11 does not
  // bite here. Held above 1.5 so it stays visible as a track.
  ["--hairline-strong", "--surface", 1.5, "empty score track vs card"],
  ["--ink", "--hairline-strong", 3.0, "score fill vs its track"],
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto("http://localhost:3000/styleguide", { waitUntil: "networkidle" });

const results = await page.evaluate((pairs) => {
  const probe = document.createElement("span");
  document.body.appendChild(probe);

  // Chrome reports computed colors in oklch(), so parsing the string yields
  // OKLCH components rather than RGB. Rasterize to get real sRGB.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const toRgb = (token) => {
    probe.style.color = `var(${token})`;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  };

  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  const luminance = ([r, g, b]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  const out = pairs.map(([fg, bg, min, use]) => {
    const a = luminance(toRgb(fg));
    const b = luminance(toRgb(bg));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return { fg, bg, min, use, ratio: Math.round(ratio * 100) / 100 };
  });

  probe.remove();
  return out;
}, PAIRS);

let failures = 0;
for (const result of results) {
  const isPass = result.ratio >= result.min;
  if (!isPass) failures += 1;
  console.log(
    `${isPass ? "PASS" : "FAIL"}  ${String(result.ratio).padStart(6)}:1  ` +
      `(min ${result.min})  ${result.fg} on ${result.bg}  — ${result.use}`,
  );
}
console.log(`\n${results.length - failures}/${results.length} pass`);

await browser.close();
process.exit(failures > 0 ? 1 : 0);
