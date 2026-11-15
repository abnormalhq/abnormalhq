/** Generate local, script-free SVG illustrations. Run from the repository root with Node 24. */
import { mkdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { illustrations, illustrationHeight, type Illustration } from "../src/content/help/illustrations.ts";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);

mkdirSync("public/help/images", { recursive: true });
for (const [lang, entries] of Object.entries<Record<string, Illustration>>(illustrations)) {
  for (const [key, { title, alt, steps }] of Object.entries(entries)) {
    const height = illustrationHeight(steps.length);
    const nodes = steps
      .map(([heading, detail], index) => {
        const y = 120 + index * 132;
        return `<g transform="translate(0 ${y})">
  ${index < steps.length - 1 ? '<path d="M58 76v58m-6-6 6 6 6-6" fill="none" stroke="#aaa99e" stroke-width="2"/>' : ""}
  <rect x="100" y="0" width="584" height="108" rx="12" fill="#fff" stroke="#ddddd4"/>
  <circle cx="58" cy="40" r="22" fill="#ffe14d"/>
  <text x="58" y="48" text-anchor="middle" font-size="22" font-weight="600">${index + 1}</text>
  <text x="120" y="40" font-size="25" font-weight="600">${escape(heading)}</text>
  <text x="120" y="78" font-size="21" fill="#575750">${escape(detail)}</text>
</g>`;
      })
      .join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" lang="${lang}" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title>
<desc id="desc">${escape(alt)}</desc>
<rect width="720" height="${height}" fill="#f6f6f1"/>
<g fill="#141412" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif">
<text x="36" y="37" font-size="14" letter-spacing="2" fill="#575750">ABNORMAL / ${lang === "zh" ? "帮助图解" : "ILLUSTRATED HELP"}</text>
<text x="36" y="82" font-size="30" font-weight="600">${escape(title)}</text>
${nodes}
</g>
</svg>\n`;
    writeFileSync(`public/help/images/${lang}-${key}.svg`, await format(svg, { parser: "html", printWidth: 120 }));
  }
}
