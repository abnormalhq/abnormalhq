/**
 * Markdown for agents: the home page is generated from the UI copy, the pricing page from the copy and the live catalog, the help center from its articles (src/content/help/), the legal pages use the MDX body, the storefront pages (redeem, guide, shop)
 * come from src/storefront/lib/markdown.ts, and llms.txt is the index of all of them.
 * The copy exists only once, in src/i18n; change the UI copy and this follows.
 */
import {
  absoluteUrl,
  configuredVideo,
  desktopDownloads,
  linksFor,
  site,
  type Lang,
  type LinkKey,
  type PromoVideo,
} from "../data/site.ts";
import {
  helpArticle,
  helpArticles,
  helpCategoryIds,
  helpContent,
  helpPath,
  type HelpSlug,
} from "../content/help/index.ts";
import { securityContent } from "../content/security/index.ts";
import { copies, langs, localePath } from "../i18n/index.ts";
import type { LegalFrontmatter } from "../content/legal/types.ts";
import { sectionsMarkdown } from "./docs.ts";
import { contactChannels } from "./inquiry.ts";
import { markdownResponse } from "./markdown-response.ts";
import {
  fetchDesktopReleases,
  fileLabel,
  formatSize,
  linuxDownload,
  releaseDate,
  type DesktopReleases,
} from "./releases.ts";
import { pageFor, pagePaths } from "./pages.ts";
import { planRowsFor, planViews } from "./pricing.ts";
import type { ShopCatalog } from "../storefront/lib/catalog.ts";
import { storeMarkdownPaths, storeTitle } from "../storefront/lib/markdown.ts";

const absolute = (path: string) => `${site.url}${path}`;
/** linksFor gives site paths for the storefront pages; Markdown needs full addresses. */
const absoluteLinks = (lang: Lang) =>
  Object.fromEntries(Object.entries(linksFor(lang)).map(([key, href]) => [key, absoluteUrl(href)])) as Record<
    LinkKey,
    string
  >;
const paragraphs = (lines: readonly string[]) => lines.join("\n\n");
const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

export function homeMarkdown(lang: Lang, video: PromoVideo | null = configuredVideo(lang)): string {
  const t = copies[lang];
  const links = absoluteLinks(lang);
  const email = site.contact.email;

  return `${paragraphs([
    `# ${t.meta.title}`,
    t.meta.description,
    // The promo video appears only when an address is configured (promoVideos in src/data/site.ts).
    ...(video ? [`## ${t.video.title}`, `${t.video.description} [${t.video.label}](${absoluteUrl(video.src)})`] : []),
    `## ${t.features.title}`,
    list(t.features.items.map((item) => `${item.title}: ${item.description}`)),
    `### ${t.features.platformsTitle}`,
    list(
      t.features.platforms.map(
        (platform) =>
          `[${platform.name}](${platform.link ? links[platform.link] : absolute(localePath(lang, platform.path ?? "/"))}): ${platform.description}`,
      ),
    ),
    `## ${t.start.title}`,
    list([
      ...t.start.entries.map((entry) => `[${entry.title}](${links[entry.link]}): ${entry.description}`),
      ...t.start.secondary.map((item) => `[${item.label}](${links[item.link]})`),
    ]),
    // Prices are live and this page is prerendered, so they are on the pricing page's own Markdown, linked here.
    `## ${t.pricing.title}`,
    `${t.pricing.intro.join(t.space)} [${t.pricing.compareLink}](${links.pricing})`,
    `### ${t.pricing.included.title}`,
    t.pricing.included.intro,
    list(t.pricing.included.items.map((item) => `${item.title}: ${item.description}`)),
    `## ${t.services.titleLines.join(t.space)}`,
    ...t.services.products.flatMap((product) => [
      `### ${product.name}`,
      product.description,
      product.link
        ? `[${product.actionLabel ?? product.name}](${links[product.link]}): ${product.priceNote}`
        : `${t.services.priceFallback}: ${product.priceNote}`,
    ]),
    t.services.noteFine,
    `## ${t.process.title}`,
    t.process.steps
      .map((step, index) => `${index + 1}. ${step.title}: ${step.description} [${step.action}](${links[step.link]})`)
      .join("\n"),
    `## ${t.faq.title}`,
    ...t.faq.items.flatMap((item) => [`### ${item.question}`, item.answer]),
    `[${t.faq.help}](${links.help})`,
    `## ${t.footer.contactLabel}`,
    `${t.start.support}: [${email}](mailto:${email})`,
    `[${t.security.navLabel}](${links.security})`,
    `## ${t.footer.legalLabel}`,
    list(t.legalPages.map((page) => `[${page.label}](${absolute(pageFor(lang, toPagePath(page.path)).markdown)})`)),
  ])}\n`;
}

/** Markdown response for the download page: reads the release list on every request, called by the /md/download/ and /md/zh/download/ routes. */
export async function downloadMarkdownResponse(lang: Lang): Promise<Response> {
  return markdownResponse(pageFor(lang, "/download/"), downloadMarkdown(lang, await fetchDesktopReleases()));
}

export function downloadMarkdown(lang: Lang, releases: DesktopReleases | undefined): string {
  const t = copies[lang];
  const d = t.download;
  // Only when the current release has Linux packages, as on the page.
  const linux = linuxDownload(releases);
  const history = releases
    ? [
        `## ${d.historyTitle}`,
        releases.previous.length > 0 ? d.historyIntro : d.historyEmpty,
        ...(releases.previous.length > 0
          ? [
              list(
                releases.previous.map((release) =>
                  [
                    `${release.version} (${releaseDate(release)})`,
                    ...release.files.map((file) => `[${fileLabel(file)}, ${formatSize(file.size)}](${file.url})`),
                    `[${d.historyChecksums}](${release.manifestUrl})`,
                  ].join(" · "),
                ),
              ),
            ]
          : []),
      ]
    : [];
  return `${paragraphs([
    `# ${d.title}`,
    linux ? d.introWithLinux : d.intro,
    ...(releases
      ? [`${d.currentLabel} ${releases.current.version} · ${d.releasedLabel} ${releaseDate(releases.current)}`]
      : []),
    `## ${d.macos.name}`,
    d.macos.requirement,
    `[${d.macos.download}](${desktopDownloads.macos})`,
    `${d.macos.brewLabel}\n\n\`\`\`sh\n${desktopDownloads.brew}\n\`\`\``,
    d.macos.firstLaunch,
    `## ${d.windows.name}`,
    d.windows.requirement,
    `[${d.windows.download}](${desktopDownloads.windows})`,
    `[${d.windows.armDownload}](${desktopDownloads.windowsArm})`,
    d.windows.firstLaunch,
    ...(linux
      ? [
          `## ${d.linux.name}`,
          d.linux.requirement,
          `[${d.linux.download}](${linux.file.url})`,
          ...(linux.arm ? [`[${d.linux.armDownload}](${linux.arm.url})`] : []),
          `${d.linux.installLabel}\n\n\`\`\`sh\n${linux.install}\n\`\`\``,
          d.linux.note,
        ]
      : []),
    `## ${d.signInTitle}`,
    d.signInSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    ...history,
    `[${d.checksums}](${desktopDownloads.manifest})`,
    `${d.webmailNote}${t.space}[${d.webmailLink}](${linksFor(lang).webmail})`,
  ])}\n`;
}

/**
 * Markdown of the pricing page: the plans on sale with the same values the page shows (src/lib/pricing.ts), the comparison as a table,
 * and what every mailbox gets. `catalog` is read per request by the /md/pricing/ routes (src/lib/pricing-markdown.ts); null means it
 * could not be read, and the text then says so and points at the catalog endpoint instead of listing prices.
 */
export function pricingMarkdown(lang: Lang, catalog: ShopCatalog | null): string {
  const t = copies[lang];
  const p = t.pricing;
  const links = absoluteLinks(lang);
  const plans = catalog ? planViews(catalog, lang, p, linksFor(lang).shop) : [];
  const rows = planRowsFor(plans);
  const cell = (text: string) => text.replace(/[\\|]/g, "\\$&").replace(/\s*\n\s*/g, " ");
  return `${paragraphs([
    `# ${p.title}`,
    p.pageIntro,
    ...(!catalog
      ? [`${p.errorTitle}${t.dot}${t.space}${p.errorBody}`]
      : plans.length === 0
        ? [`${p.closedTitle}${t.dot}${t.space}${p.closedBody}`]
        : [
            ...plans.flatMap((plan) => [
              `## ${plan.name}`,
              ...(plan.description ? [plan.description] : []),
              // A plan sold per mailbox: the amounts below are for one mailbox.
              ...(plan.note ? [plan.note] : []),
              list([
                ...rows.map(
                  (row) =>
                    `${p.compare.rows[row]}${t.legal.colon}${plan.rows[row]}${
                      row === "price" && plan.discount
                        ? ` (${plan.discount.label}, ${p.plan.originalPrice} ${plan.discount.original})`
                        : ""
                    }`,
                ),
              ]),
              `[${plan.chooseLabel}](${absoluteUrl(plan.href)})`,
            ]),
            p.priceNote,
            ...(plans.length > 1
              ? [
                  `## ${p.compare.title}`,
                  [
                    `| ${[p.compare.feature, ...plans.map((plan) => cell(plan.name))].join(" | ")} |`,
                    `| ${["---", ...plans.map(() => "---")].join(" | ")} |`,
                    ...rows.map(
                      (row) => `| ${[p.compare.rows[row], ...plans.map((plan) => cell(plan.rows[row]))].join(" | ")} |`,
                    ),
                  ].join("\n"),
                ]
              : []),
          ]),
    `## ${p.included.title}`,
    p.included.intro,
    list(p.included.items.map((item) => `${item.title}: ${item.description}`)),
    `[${p.shopLink}](${links.shop})`,
  ])}\n`;
}

/** The help center's index: every article by topic, linking to the articles' own Markdown. */
export function helpIndexMarkdown(lang: Lang): string {
  const h = copies[lang].help;
  const { categories } = helpContent[lang];
  const articles = helpArticles(lang);
  return `${paragraphs([
    `# ${h.title}`,
    h.intro,
    ...helpCategoryIds.flatMap((category) => [
      `## ${categories[category]}`,
      list(
        articles
          .filter((article) => article.category === category)
          .map(
            (article) =>
              `[${article.title}](${absolute(pageFor(lang, helpPath(article.slug)).markdown)}): ${article.summary}`,
          ),
      ),
    ]),
    `## ${h.ask.title}`,
    `${h.ask.body} [${site.contact.email}](mailto:${site.contact.email})`,
  ])}\n`;
}

/** One help article: its sections as written, then the way back to the index and on to support, as on the page. */
export function helpArticleMarkdown(lang: Lang, slug: HelpSlug): string {
  const h = copies[lang].help;
  const article = helpArticle(lang, slug);
  return `${paragraphs([
    `# ${article.title}`,
    article.summary,
    ...sectionsMarkdown(article.sections, lang),
    `## ${h.wrong.title}`,
    h.wrong.body,
    list([
      `[${h.wrong.index}](${absolute(pageFor(lang, "/help/").markdown)})`,
      `[${h.wrong.contact}](mailto:${site.contact.email})`,
    ]),
  ])}\n`;
}

/** The security and privacy overview: its sections as written, the date they were last checked, and the way on to the policy. */
export function securityMarkdown(lang: Lang): string {
  const t = copies[lang];
  const content = securityContent[lang];
  return `${paragraphs([
    `# ${content.title}`,
    content.summary,
    `${t.security.reviewedLabel}${t.legal.colon}${content.reviewed}`,
    ...sectionsMarkdown(content.sections, lang),
    list([
      `[${t.security.policyLink}](${absolute(pageFor(lang, "/privacy/").markdown)})`,
      `[${t.security.helpLink}](${absolute(pageFor(lang, "/help/").markdown)})`,
    ]),
  ])}\n`;
}

/** Legal page paths in the copy are plain strings; this confirms the path really is a page in the list. */
function toPagePath(path: string) {
  const match = pagePaths.find((pagePath) => pagePath === path);
  if (!match) throw new Error(`Unknown page path: ${path}`);
  return match;
}

/** Strips the frontmatter at the top of the MDX, leaving the body. The legal documents contain no JSX, so the body is plain Markdown. */
export function stripFrontmatter(source: string): string {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export function legalMarkdown(lang: Lang, frontmatter: LegalFrontmatter, body: string): string {
  const l = copies[lang].legal;
  const contacts = contactChannels(site.contact, l.contactLabels);
  return `${paragraphs([
    `# ${frontmatter.title}`,
    frontmatter.summary,
    list([`${l.effective}: ${frontmatter.effective}`, `${l.updated}: ${frontmatter.updated}`]),
    `## ${l.highlights}`,
    list(frontmatter.highlights),
    l.highlightsNote,
    body,
    // In the HTML version this section is rendered by LegalDocument rather than in the MDX body, and the body tells readers to refer to it.
    `## ${l.contactTitle}`,
    l.contactBody(frontmatter.title),
    contacts.length > 0
      ? list(contacts.map(({ label, value, href }) => `${label}${l.colon}${href ? `[${value}](${href})` : value}`))
      : l.contactPending,
  ])}\n`;
}

function llmsSection(lang: Lang, heading: string): string {
  const t = copies[lang];
  const links = absoluteLinks(lang);
  return paragraphs([
    `## ${heading}`,
    list([
      `[${t.meta.title}](${absolute(pageFor(lang, "/").markdown)})`,
      `[${t.pricing.metaTitle}](${absolute(pageFor(lang, "/pricing/").markdown)})`,
      ...storeMarkdownPaths.map((path) => `[${storeTitle(lang, path)}](${absolute(pageFor(lang, path).markdown)})`),
      `[${t.help.navLabel}](${absolute(pageFor(lang, "/help/").markdown)})`,
      ...helpArticles(lang).map(
        (article) => `[${article.title}](${absolute(pageFor(lang, helpPath(article.slug)).markdown)})`,
      ),
      `[${t.security.navLabel}](${absolute(pageFor(lang, "/security/").markdown)})`,
      `[${t.download.title}](${absolute(pageFor(lang, "/download/").markdown)})`,
      ...t.legalPages.map((page) => `[${page.label}](${absolute(pageFor(lang, toPagePath(page.path)).markdown)})`),
      ...[...t.footer.productLinks, ...t.footer.supportLinks].map((item) => `[${item.label}](${links[item.link]})`),
    ]),
  ]);
}

/** Heading of each language's section in llms.txt, in that language's own name. */
const languageNames: Record<Lang, string> = { en: "English", zh: "中文" };

/** Format per https://llmstxt.org/. Languages are listed in the order of langs, default language (English) first. */
export function llmsTxt(): string {
  return `${paragraphs([
    "# Abnormal",
    ...langs.map((lang) => `> ${copies[lang].meta.description}`),
    ...langs.map((lang) => llmsSection(lang, languageNames[lang])),
  ])}\n`;
}
