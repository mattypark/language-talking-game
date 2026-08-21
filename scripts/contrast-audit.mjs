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
 * The /styleguide URL is incidental, not a coupling: tokens.css is imported
 * globally, so every token resolves on every route. The styleguide is used only
 * because it is the page most obviously about the palette. Nothing needs adding
 * to that page for a new pair to be measurable here.
 *
 * Exits non-zero on any failure, so it can gate a release.
 *
 * A tuple is [fg, bg, min, use] — plus an optional 5th element naming the
 * backdrop a TRANSLUCENT foreground composites over, and an optional `max` for
 * the one token that must stay BELOW a threshold.
 */
import { chromium } from "playwright";

const PAIRS = [
  /* ------------------------------------------------- body text, 4.5 minimum */
  ["--ink", "--canvas", 4.5, "body text on page"],
  ["--ink", "--surface", 4.5, "body text on card"],
  ["--ink", "--sunken", 4.5, "body text in a well"],
  ["--ink", "--stage", 4.5, "hero display type"],
  ["--ink", "--raised", 4.5, "body text in a sheet"],
  ["--ink-muted", "--canvas", 4.5, "secondary body on page"],
  ["--ink-muted", "--surface", 4.5, "secondary body on card"],
  ["--ink-muted", "--sunken", 4.5, "secondary body in a well"],
  ["--ink-muted", "--stage", 4.5, "hero secondary"],
  ["--ink-muted", "--raised", 4.5, "secondary body in a sheet"],

  /*
   * --ink-subtle is bounded from ABOVE as well as below. The rule that it is
   * "never real copy" is only enforceable while it measurably cannot carry
   * copy; if a palette tweak lifts it past 4.5 the rule silently becomes
   * tribal knowledge instead of a fact about the file.
   */
  ["--ink-subtle", "--canvas", 3.0, "disabled / decorative only — never real copy", null, 4.5],
  ["--ink-subtle", "--surface", 3.0, "placeholder in an input — never real copy", null, 4.5],

  /* ------------------------------------------- text ON the tints (dark only)
   * New with the inversion. On paper the tints were pale washes that only ever
   * carried their own -ink colour; inverted they are dark washes that carry
   * ordinary body copy — the "You spoke." card, a speaking tile, a warn badge.
   */
  ["--ink", "--live-tint", 4.5, "the 'You spoke.' card"],
  ["--ink-muted", "--live-tint", 4.5, "stat labels on the effort card"],
  ["--ink", "--partner-tint", 4.5, "partner tile name while speaking"],
  ["--ink-muted", "--partner-tint", 4.5, "partner tile note"],
  ["--ink", "--accent-tint", 4.5, "your tile while speaking / selected choice"],
  ["--ink-muted", "--accent-tint", 4.5, "your tile note"],
  ["--ink", "--warn-tint", 4.5, "warn badge body"],
  ["--ink", "--danger-tint", 4.5, "danger confirm body"],

  /* --------------------------------------------- semantic colours AS TEXT */
  ["--accent-ink", "--canvas", 4.5, "accent AS TEXT"],
  ["--accent-ink", "--surface", 4.5, "accent AS TEXT on a card"],
  ["--accent-ink", "--accent-tint", 4.5, "accent text on its tint"],
  ["--live-ink", "--live-tint", 4.5, "live badge text"],
  ["--live-ink", "--surface", 4.5, "RoomChooser live count"],
  ["--partner-ink", "--partner-tint", 4.5, "partner badge text"],
  ["--partner-ink", "--surface", 4.5, "partner label as text"],
  ["--warn-ink", "--warn-tint", 4.5, "warn badge text"],
  ["--warn-ink", "--surface", 4.5, "in-call timer running out"],
  ["--warn-ink", "--canvas", 4.5, "'under a minute left'"],
  ["--danger-ink", "--danger-tint", 4.5, "form error / danger-ghost hover"],
  ["--danger-ink", "--canvas", 4.5, "Leave button at rest"],

  /* ------------------------------------------------------- labels on fills */
  ["--on-accent", "--accent", 4.5, "label on primary button"],
  ["--on-accent", "--danger", 4.5, "label on danger button"],

  /* ------------------------------------------- UI components, 3.0 minimum */
  ["--accent", "--canvas", 3.0, "primary button fill vs page"],
  ["--accent", "--surface", 3.0, "primary button fill vs card"],
  ["--accent-bright", "--canvas", 3.0, "topic rail / mark vs page"],
  ["--accent-bright", "--surface", 3.0, "topic rail / waveform vs card"],
  ["--live", "--surface", 3.0, "live dot vs card"],
  ["--partner", "--surface", 3.0, "partner ring vs card"],
  ["--danger", "--surface", 3.0, "danger vs card"],
  ["--warn", "--surface", 3.0, "warn vs card"],
  ["--partner", "--partner-tint", 3.0, "speaking ring vs its own fill"],
  ["--accent-bright", "--accent-tint", 3.0, "your speaking ring vs its own fill"],
  ["--ink", "--hairline", 3.0, "score fill vs its track"],

  /* --------------------------------------------------------------- structure */
  ["--hairline", "--surface", 1.0, "hairline — decorative, no minimum"],
  ["--hairline-strong", "--canvas", 1.5, "divider on the page"],
  // The empty score track is a container, not the meter's value: the filled
  // portion and the printed number both carry the reading, so 1.4.11 does not
  // bite here. Held above 1.5 so it stays visible as a track.
  ["--hairline-strong", "--surface", 1.5, "divider on a card"],
  // Translucent: measured composited over the surface it actually sits on.
  ["--stage-hairline", "--stage", 1.5, "hero nav rule", "--stage"],
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto((process.env.ONAIR_BASE ?? "http://localhost:3000") + "/styleguide", { waitUntil: "networkidle" });

const results = await page.evaluate((pairs) => {
  const probe = document.createElement("span");
  document.body.appendChild(probe);

  // Chrome reports computed colors in oklch(), so parsing the string yields
  // OKLCH components rather than RGB. Rasterize to get real sRGB.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  /*
   * getImageData returns STRAIGHT (un-premultiplied) alpha. Reading only
   * [r,g,b] and discarding it reports a 32%-opacity cream as full-strength
   * cream — ~17:1 instead of its real ~2.7:1. Harmless while no translucent
   * token was audited; --stage-hairline is one, so alpha comes back too.
   */
  const toRgba = (token) => {
    probe.style.color = `var(${token})`;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };

  // Composite in sRGB byte space, which is what CSS does by default.
  const resolve = (token, overToken) => {
    const [r, g, b, a] = toRgba(token);
    if (a >= 1 || !overToken) return [r, g, b];
    const [br, bg, bb] = resolve(overToken, null);
    return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)];
  };

  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  const luminance = ([r, g, b]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  const out = pairs.map(([fg, bg, min, use, over, max]) => {
    const a = luminance(resolve(fg, over));
    const b = luminance(resolve(bg, null));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return { fg, bg, min, max, use, ratio: Math.round(ratio * 100) / 100 };
  });

  probe.remove();
  return out;
}, PAIRS);

let failures = 0;
for (const result of results) {
  const tooLow = result.ratio < result.min;
  const tooHigh = result.max != null && result.ratio > result.max;
  if (tooLow || tooHigh) failures += 1;

  const bound =
    result.max != null ? `(${result.min}–${result.max})` : `(min ${result.min})`;

  console.log(
    `${tooLow || tooHigh ? "FAIL" : "PASS"}  ${String(result.ratio).padStart(6)}:1  ` +
      `${bound}  ${result.fg} on ${result.bg}  — ${result.use}` +
      (tooHigh ? "  [ABOVE its ceiling: this token must not be readable copy]" : ""),
  );
}
console.log(`\n${results.length - failures}/${results.length} pass`);

await browser.close();
process.exit(failures > 0 ? 1 : 0);
