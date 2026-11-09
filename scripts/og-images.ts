/**
 * Generates the social card images public/og/zh.png and public/og/en.png (1200x630, referenced by src/lib/metadata.ts).
 * The copy comes from the hero title and the social description; rerun after changing those in src/i18n.
 *
 * This repository does not depend on Playwright: install it and its Chromium globally, then point NODE_PATH at the global directory so the script can load it:
 *
 *   npm install -g playwright && playwright install chromium
 *   NODE_PATH="$(npm root -g)" node scripts/og-images.ts
 *
 * Chinese glyphs come from Noto Sans SC on Google Fonts, so generating needs network access.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { site, type Lang } from "../src/data/site.ts";
import { en } from "../src/i18n/en.ts";
import type { Copy } from "../src/i18n/types.ts";
import { zh } from "../src/i18n/zh.ts";

// Loaded with require so a globally installed Playwright (NODE_PATH) is found too.
// This repository does not depend on Playwright, so only the parts used here are typed.
interface Page {
  setContent(html: string, options: { waitUntil: "networkidle" }): Promise<void>;
  evaluate(fn: () => unknown): Promise<unknown>;
  screenshot(options: { path: string; type: "png" }): Promise<unknown>;
}
interface Browser {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<Page>;
  close(): Promise<void>;
}
const { chromium } = createRequire(import.meta.url)("playwright") as { chromium: { launch(): Promise<Browser> } };

const copies: Record<Lang, Copy> = { zh, en };
const root = new URL("../", import.meta.url);
// A page loaded with setContent cannot read file:// fonts, so they are inlined as data URLs.
const font = (file: string) =>
  `data:font/woff2;base64,${readFileSync(new URL(`public/fonts/${file}`, root)).toString("base64")}`;

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

// The same brand mark as src/components/ui/brand-mark.tsx.
const glyph =
  "M21.4 36 21.09 33.92Q20.26 35.01 19.14 35.59Q18.01 36.18 16.16 36.18Q14.38 36.18 13.09 35.58Q11.8 34.99 11.1 33.92Q10.4 32.85 10.4 31.41Q10.4 29.27 11.97 27.83Q13.55 26.39 16.62 26.05L21.09 25.55V24.25Q21.09 23.42 20.36 22.76Q19.63 22.09 18.08 22.09Q16.72 22.09 15.71 22.76Q14.71 23.42 14.37 24.74L11.03 23.51Q11.69 21.27 13.61 20.01Q15.52 18.76 18.28 18.76Q21.6 18.76 23.27 20.42Q24.93 22.08 24.93 24.67V36ZM21.09 28.52 16.99 29.04Q15.7 29.21 15.06 29.77Q14.41 30.34 14.41 31.17Q14.41 31.97 15.03 32.51Q15.65 33.06 16.76 33.06Q18.16 33.06 19.13 32.56Q20.1 32.07 20.59 31.11Q21.09 30.15 21.09 28.76Z";
const mark = `<svg viewBox="0 0 48 48" width="56" height="56" style="border-radius:6px"><rect width="48" height="48" fill="#ffe14d"/><path d="${glyph}" fill="#f7f7f4" transform="translate(2.2 0)"/><path d="${glyph}" fill="#141412"/><path d="M28 21 37.8 11.2M30.5 10H39v8.5" fill="none" stroke="#141412" stroke-width="3.2" stroke-linecap="square"/></svg>`;

function card(lang: Lang): string {
  const t = copies[lang];
  const [first, second] = t.hero.titleLines;
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600&display=block">
<style>
  @font-face { font-family: Inter; src: url(${font("Inter-Variable.woff2")}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: Bricolage; src: url(${font("BricolageGrotesque-Variable.woff2")}) format("woff2"); font-weight: 200 800; }
  @font-face { font-family: Mono; src: url(${font("JetBrainsMono-Variable.woff2")}) format("woff2"); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #f7f7f4; color: #141412;
    font-family: Inter, "Noto Sans SC", sans-serif; position: relative; }
  .frame { position: absolute; inset: 40px; border: 1px solid #e3e3dc; border-radius: 12px; overflow: hidden; }
  .rings { position: absolute; right: -150px; top: -40px; width: 600px; height: 600px; border: 1px solid #e3e3dc;
    border-radius: 50%; display: grid; place-items: center; }
  .rings::before { content: ""; position: absolute; inset: 64px; border: 1px solid #e3e3dc; border-radius: 50%; }
  .rings span { font-family: Bricolage; font-weight: 300; font-size: 380px; line-height: 1; color: #ecece6;
    transform: rotate(-18deg) translateY(-24px); }
  .tag { position: absolute; right: 88px; top: 150px; background: #ffe14d; color: #141412; font-family: Mono;
    font-size: 26px; font-weight: 500; padding: 10px 18px; border-radius: 4px; transform: rotate(-4deg); }
  .content { position: absolute; inset: 56px 64px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 16px; font-family: Bricolage; font-weight: 600; font-size: 34px;
    letter-spacing: -0.02em; }
  .eyebrow { margin-top: 64px; font-family: Mono; font-size: 20px; letter-spacing: 0.08em; text-transform: uppercase;
    color: #5c5c55; }
  h1 { margin-top: 18px; font-family: Bricolage, "Noto Sans SC"; font-weight: 600; font-size: 76px; line-height: 1.18;
    letter-spacing: -0.02em; }
  h1 .muted { color: #5c5c55; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 48px;
    font-size: 24px; line-height: 1.5; color: #5c5c55; }
  .footer p { max-width: 720px; word-break: keep-all; }
  .url { font-family: Mono; font-size: 22px; color: #141412; white-space: nowrap; }
</style>
</head>
<body>
  <div class="frame">
    <div class="rings" aria-hidden="true"><span>@</span></div>
    <div class="tag">@abnormalhq.com</div>
    <div class="content">
      <div class="brand">${mark}<span>abnormal<span>.</span></span></div>
      <div class="eyebrow">${escape(t.hero.eyebrow)}</div>
      <h1>${escape(first)}<br><span class="muted">${escape(second)}</span>${escape(t.dot)}</h1>
      <div class="footer">
        <p>${escape(t.meta.socialDescription)}</p>
        <span class="url">${escape(new URL(site.url).host)}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const outDir = new URL("public/og/", root);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const lang of ["zh", "en"] as const) {
    await page.setContent(card(lang), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const path = fileURLToPath(new URL(`${lang}.png`, outDir));
    await page.screenshot({ path, type: "png" });
    console.log(path);
  }
} finally {
  await browser.close();
}
