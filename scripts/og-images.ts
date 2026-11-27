/**
 * Generates the social card images public/og/zh.png and public/og/en.png (1200x630, referenced by src/lib/metadata.ts).
 * The copy comes from the hero title and the social description; rerun after changing those in src/i18n.
 *
 * This repository does not depend on Playwright: install it and its Chromium into a scratch folder with pnpm, then point NODE_PATH at that
 * folder's node_modules so the script can load it (pnpm's global packages are isolated, so `pnpm root -g` would not work):
 *
 *   og=$(mktemp -d) && pnpm --dir "$og" add playwright && pnpm --dir "$og" exec playwright install chromium
 *   NODE_PATH="$og/node_modules" node scripts/og-images.ts
 *
 * Display serif glyphs come from Newsreader and Noto Serif SC on Google Fonts, so generating needs network access. Chinese body text
 * uses PingFang SC where it is installed and Noto Sans SC (also from Google Fonts) elsewhere, so a machine without either does not
 * fall back to whatever CJK font it happens to have.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { site, type Lang } from "../src/data/site.ts";
import { en } from "../src/i18n/en.ts";
import type { CopyMessages } from "../src/i18n/types.ts";
import { zh } from "../src/i18n/zh.ts";

// Loaded with require so a Playwright outside the repository (NODE_PATH) is found too.
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

const copies: Record<Lang, CopyMessages> = { zh, en };
const root = new URL("../", import.meta.url);
// A page loaded with setContent cannot read file:// fonts, so they are inlined as data URLs.
const font = (file: string) =>
  `data:font/woff2;base64,${readFileSync(new URL(`public/fonts/${file}`, root)).toString("base64")}`;

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

function markedHtml(line: string, marked: string): string {
  const at = line.indexOf(marked);
  if (at < 0) return escape(line);
  return `${escape(line.slice(0, at))}<span class="mark">${escape(marked)}</span>${escape(line.slice(at + marked.length))}`;
}

// The same brand mark as src/components/ui/brand-mark.tsx.
const glyph =
  "M21.4 36 21.09 33.92Q20.26 35.01 19.14 35.59Q18.01 36.18 16.16 36.18Q14.38 36.18 13.09 35.58Q11.8 34.99 11.1 33.92Q10.4 32.85 10.4 31.41Q10.4 29.27 11.97 27.83Q13.55 26.39 16.62 26.05L21.09 25.55V24.25Q21.09 23.42 20.36 22.76Q19.63 22.09 18.08 22.09Q16.72 22.09 15.71 22.76Q14.71 23.42 14.37 24.74L11.03 23.51Q11.69 21.27 13.61 20.01Q15.52 18.76 18.28 18.76Q21.6 18.76 23.27 20.42Q24.93 22.08 24.93 24.67V36ZM21.09 28.52 16.99 29.04Q15.7 29.21 15.06 29.77Q14.41 30.34 14.41 31.17Q14.41 31.97 15.03 32.51Q15.65 33.06 16.76 33.06Q18.16 33.06 19.13 32.56Q20.1 32.07 20.59 31.11Q21.09 30.15 21.09 28.76Z";
const mark = `<svg viewBox="0 0 48 48" width="52" height="52" style="border-radius:6px"><rect width="48" height="48" fill="#ffe14d"/><path d="${glyph}" fill="#f7f7f4" transform="translate(2.2 0)"/><path d="${glyph}" fill="#141412"/><path d="M28 21 37.8 11.2M30.5 10H39v8.5" fill="none" stroke="#141412" stroke-width="3.2" stroke-linecap="square"/></svg>`;

export function card(lang: Lang): string {
  const t = copies[lang];
  // Warm paper editorial cover matching the website's serif display language and one highlighter stroke.
  const [first, second] = t.hero.mail.titleLines;
  const products = t.products.items.map((item) => item.name).join("  ·  ");
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Noto+Serif+SC:wght@400;500;600&family=Noto+Sans+SC:wght@400;500&display=block">
<style>
  @font-face { font-family: Inter; src: url(${font("Inter-Variable.woff2")}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: Bricolage; src: url(${font("BricolageGrotesque-Variable.woff2")}) format("woff2"); font-weight: 200 800; }
  @font-face { font-family: Mono; src: url(${font("JetBrainsMono-Variable.woff2")}) format("woff2"); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #f7f7f4; color: #141412;
    font-family: Inter, "PingFang SC", "Noto Sans SC", sans-serif; position: relative; }
  .frame { position: absolute; inset: 36px; border: 1px solid #e3e3dc; border-radius: 12px; background: #f7f7f4;
    display: flex; flex-direction: column; padding: 48px 56px; }
  .top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 28px;
    border-bottom: 1px solid #e3e3dc; }
  .brand { display: flex; align-items: center; gap: 16px; font-family: Bricolage; font-weight: 600; font-size: 32px;
    letter-spacing: -0.02em; color: #141412; }
  .top-right { display: flex; align-items: center; gap: 18px; font-family: Mono; font-size: 18px; color: #5c5c55; }
  .pill { background: #dfeae2; color: #2a4e3c; padding: 6px 14px; border-radius: 4px; font-size: 16px; font-weight: 500; }
  .eyebrow { margin-top: 44px; font-family: Mono; font-size: 17px; letter-spacing: 0.08em; text-transform: uppercase;
    color: #b0502a; }
  h1 { margin-top: 18px; font-family: Newsreader, "Noto Serif SC", "Songti SC", Georgia, serif;
    font-weight: ${lang === "zh" ? 500 : 400}; font-size: ${lang === "zh" ? 74 : 84}px;
    line-height: ${lang === "zh" ? 1.16 : 1.06}; letter-spacing: ${lang === "zh" ? "0em" : "-0.025em"}; color: #141412; }
  .mark { background: linear-gradient(transparent 60%, #ffe14d 60% 92%, transparent 92%); padding: 0 6px; }
  .footer { margin-top: auto; padding-top: 26px; border-top: 1px solid #e3e3dc; display: flex;
    justify-content: space-between; align-items: flex-end; gap: 40px; font-size: 22px; line-height: 1.5; color: #5c5c55; }
  .footer p { max-width: 740px; word-break: keep-all; }
  .url { font-family: Mono; font-size: 20px; font-weight: 500; color: #141412; white-space: nowrap; }
</style>
</head>
<body>
  <div class="frame">
    <div class="top">
      <div class="brand">${mark}<span>abnormal.</span></div>
      <div class="top-right"><span class="pill">${escape(products)}</span></div>
    </div>
    <div class="eyebrow">${escape(t.hero.eyebrow)}</div>
    <h1>${escape(first)}<br>${markedHtml(second, t.hero.mail.marked)}</h1>
    <div class="footer">
      <p>${escape(t.meta.socialDescription)}</p>
      <span class="url">${escape(new URL(site.url).host)}</span>
    </div>
  </div>
</body>
</html>`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { chromium } = createRequire(import.meta.url)("playwright") as {
    chromium: { launch(options: { args: string[] }): Promise<Browser> };
  };
  const outDir = new URL("public/og/", root);
  mkdirSync(outDir, { recursive: true });
  // Render in sRGB whatever the machine's display profile, so the cards carry the exact theme colors (the brand yellow stays
  // #ffe14d): an earlier pair of cards came out with #f1e26c in its place.
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
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
}
