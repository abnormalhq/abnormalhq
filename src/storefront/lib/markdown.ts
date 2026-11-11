/**
 * Markdown of the storefront pages (redeem, guide, shop) for agents, generated from the UI copy: the copy exists once in i18n.ts and shop-copy.ts,
 * so this follows when the UI changes. src/lib/markdown.ts serves it at /md/redeem/, /md/zh/guide/ and so on, and lists it in llms.txt.
 * Plans and prices are fetched from mail at runtime and not hard-coded here; this only points at the catalog endpoint.
 */
import { siteName, supportEmail } from "../config.ts";
import { LANG_PATHS, copy, storePath, type GuideBlock, type Lang } from "../i18n.ts";
import { absoluteUrl } from "../site.ts";
import { shopCopy } from "./shop-copy.ts";

/** The storefront pages that have a Markdown version, by path without the language prefix. */
export const storeMarkdownPaths = ["/redeem/", "/guide/", "/shop/"] as const;
export type StoreMarkdownPath = (typeof storeMarkdownPaths)[number];

const paragraphs = (parts: readonly string[]) => `${parts.join("\n\n")}\n`;
const bullets = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");
const numbered = (items: readonly string[]) => items.map((item, index) => `${index + 1}. ${item}`).join("\n");

const colon: Record<Lang, string> = { zh: "：", en: ": " };

const catalogNote: Record<Lang, (url: string) => string> = {
  zh: (url) =>
    `当前在售的套餐、价格与可选域名见[套餐目录](${url})（JSON）。其中 \`priceCents\` 是实付金额，单位为百分之一 LDC；\`available\` 为 \`false\` 表示暂未开放购买。按邮箱数量计价的套餐列在 \`seatProducts\` 下，其中的价格是单个邮箱的价格，可购买 \`seatMin\` 到 \`seatMax\` 个；\`customDomains\` 大于 0 的套餐可以接入相应数量的自有域名。`,
  en: (url) =>
    `The plans on sale, their prices and domains are in the [catalog](${url}) (JSON). \`priceCents\` is the amount to pay in hundredths of an LDC; \`available\` is \`false\` while the shop is closed. Plans sold per mailbox are listed under \`seatProducts\`: their prices are for one mailbox, and \`seatMin\` to \`seatMax\` of them can be bought. A plan with \`customDomains\` above 0 lets its buyer connect that many domains of their own.`,
};

type Kind = "home" | "guide" | "shop";
const pageUrl = (lang: Lang, kind: Kind) => absoluteUrl(storePath(lang, kind === "home" ? undefined : `${kind}/`));

/** Site links in copy are relative to the language root (RichText resolves them the same way on the page); Markdown needs full addresses. */
function withAbsoluteLinks(text: string, lang: Lang): string {
  return text.replace(/\]\(([^)\s]+)\)/g, (link, href: string) =>
    /^(https?:|mailto:|#)/.test(href) ? link : `](${absoluteUrl(`${LANG_PATHS[lang]}${href}`)})`,
  );
}

function homeMarkdown(lang: Lang): string {
  const t = copy[lang];
  const { code, options, accounts, notify } = t.steps;
  return paragraphs([
    `# ${t.title}`,
    t.description,
    t.tagline,
    `## ${t.ui.formTitle}`,
    t.ui.formDescription,
    numbered([code, options, accounts, notify].map((step) => `**${step.label}**${colon[lang]}${step.hint}`)),
    `${t.submitNote} ${t.noscript}`,
    `## ${t.ui.guideTitle}`,
    `${t.ui.guideDescription} [${t.ui.guideLink}](${pageUrl(lang, "guide")})`,
    `## ${shopCopy[lang].nav}`,
    `${shopCopy[lang].description} [${shopCopy[lang].choose}](${pageUrl(lang, "shop")})`,
    `## ${t.help.title}`,
    ...t.help.items.flatMap((item) => [`### ${item.q}`, withAbsoluteLinks(item.a, lang)]),
    `## ${t.ui.supportTitle}`,
    `${t.help.contact[0]}[${supportEmail}](mailto:${supportEmail})${t.help.contact[1]}`,
    bullets(t.footer.links.map((link) => `[${link.label}](${link.href})`)),
  ]);
}

function guideBlock(block: GuideBlock, lang: Lang): string {
  if ("p" in block) return withAbsoluteLinks(block.p, lang);
  if ("ol" in block) return numbered(block.ol.map((item) => withAbsoluteLinks(item, lang)));
  return bullets(block.ul.map((item) => withAbsoluteLinks(item, lang)));
}

function guideMarkdown(lang: Lang): string {
  const t = copy[lang].guide;
  return paragraphs([
    `# ${t.heading}`,
    t.lede,
    ...t.sections.flatMap((section) => [
      `## ${section.title}`,
      ...section.blocks.map((block) => guideBlock(block, lang)),
    ]),
  ]);
}

function shopMarkdown(lang: Lang): string {
  const t = shopCopy[lang];
  return paragraphs([
    `# ${t.title}`,
    t.description,
    `## ${t.choose}`,
    t.pricing,
    catalogNote[lang](absoluteUrl("api/shop/catalog")),
    `## ${t.processTitle}`,
    numbered(t.steps),
    t.expiryNote,
    t.browserNote,
    `[${t.back}](${pageUrl(lang, "home")})`,
  ]);
}

/** Markdown of one storefront page. */
export function storeMarkdown(lang: Lang, path: StoreMarkdownPath): string {
  if (path === "/redeem/") return homeMarkdown(lang);
  return path === "/guide/" ? guideMarkdown(lang) : shopMarkdown(lang);
}

/** The page titles llms.txt lists them under. */
export function storeTitle(lang: Lang, path: StoreMarkdownPath): string {
  if (path === "/redeem/") return copy[lang].title;
  return path === "/guide/" ? copy[lang].guide.title : `${shopCopy[lang].nav} · ${siteName}`;
}
