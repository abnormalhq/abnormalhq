/**
 * Markdown for agents: the home page is generated from the UI copy, the legal pages use the MDX body, and llms.txt is the index of both.
 * The copy exists only once, in src/i18n; change the UI copy and this follows.
 */
import {
  absoluteUrl,
  configuredVideo,
  desktopDownloads,
  linksFor,
  site,
  type Lang,
  type PromoVideo,
} from "../data/site.ts";
import { copies, langs } from "../i18n/index.ts";
import type { LegalFrontmatter } from "../content/legal/types.ts";
import { contactChannels } from "./inquiry.ts";
import { markdownResponse } from "./markdown-response.ts";
import { fetchDesktopReleases, fileLabel, formatSize, releaseDate, type DesktopReleases } from "./releases.ts";
import { pageFor, pagePaths } from "./pages.ts";

const absolute = (path: string) => `${site.url}${path}`;
const paragraphs = (lines: readonly string[]) => lines.join("\n\n");
const list = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

export function homeMarkdown(lang: Lang, video: PromoVideo | null = configuredVideo(lang)): string {
  const t = copies[lang];
  const links = linksFor(lang);
  const email = site.contact.email;

  return `${paragraphs([
    `# ${t.meta.title}`,
    t.meta.description,
    // The promo video appears only when an address is configured (promoVideos in src/data/site.ts).
    ...(video ? [`## ${t.video.title}`, `${t.video.description} [${t.video.label}](${absoluteUrl(video.src)})`] : []),
    `## ${t.start.title}`,
    list([
      ...t.start.entries.map((entry) => `[${entry.title}](${links[entry.link]}): ${entry.description}`),
      ...t.start.secondary.map((item) => `[${item.label}](${links[item.link]})`),
    ]),
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
    `## ${t.footer.contactLabel}`,
    `${t.start.support}: [${email}](mailto:${email})`,
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
    d.intro,
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
    `## ${d.signInTitle}`,
    d.signInSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    ...history,
    `[${d.checksums}](${desktopDownloads.manifest})`,
    `${d.webmailNote}${t.space}[${d.webmailLink}](${linksFor(lang).webmail})`,
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
  const links = linksFor(lang);
  return paragraphs([
    `## ${heading}`,
    list([
      `[${t.meta.title}](${absolute(pageFor(lang, "/").markdown)})`,
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
