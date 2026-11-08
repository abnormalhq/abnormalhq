/**
 * schema.org structured data (JSON-LD), helping search engines and AI recognize the brand, the website and the page content.
 * Each page emits one @graph: the organization and website are the same on every page and reference each other by @id; the home page adds the FAQ, legal pages add breadcrumbs and revision dates.
 * Everything comes from the UI copy and frontmatter; nothing that is not visible on the page is written.
 */
import type { LegalFrontmatter } from "../content/legal/types.ts";
import { absoluteUrl, configuredVideo, site, type Lang, type PromoVideo } from "../data/site.ts";
import { copies } from "../i18n/index.ts";
import { langs, localePath } from "../i18n/paths.ts";
import { socialImage } from "./metadata.ts";

type Node = Record<string, unknown>;

const organizationId = `${site.url}/#organization`;
const websiteId = `${site.url}/#website`;
const absolute = (path: string) => `${site.url}${path}`;

function organization(): Node {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: site.name,
    url: `${site.url}/`,
    logo: { "@type": "ImageObject", url: absolute("/icon.png"), width: 512, height: 512 },
    email: site.contact.email,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: site.contact.email,
      availableLanguage: langs.map((lang) => copies[lang].htmlLang),
    },
  };
}

function website(lang: Lang): Node {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    name: site.name,
    url: `${site.url}/`,
    description: copies[lang].meta.description,
    inLanguage: langs.map((lang) => copies[lang].htmlLang),
    publisher: { "@id": organizationId },
  };
}

function webPage(lang: Lang, path: string, name: string, description: string): Node {
  const url = absolute(localePath(lang, path));
  return {
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: copies[lang].htmlLang,
    isPartOf: { "@id": websiteId },
    publisher: { "@id": organizationId },
    primaryImageOfPage: { "@type": "ImageObject", url: absolute(socialImage(lang).url), width: 1200, height: 630 },
  };
}

const graph = (nodes: Node[]) => ({ "@context": "https://schema.org", "@graph": nodes });

/** The home page's promo video (only when an address is configured): name and description from the section copy, poster and upload date from the configuration. */
function videoObject(lang: Lang, pageUrl: string, video: PromoVideo): Node {
  const t = copies[lang];
  return {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: t.video.title,
    description: t.video.description,
    contentUrl: absoluteUrl(video.src),
    thumbnailUrl: absoluteUrl(video.poster),
    uploadDate: video.uploadDate,
    inLanguage: t.htmlLang,
    publisher: { "@id": organizationId },
  };
}

/** Home page: organization, website, and the page itself with the FAQ; plus the video when a promo video is configured. */
export function homeStructuredData(lang: Lang, video: PromoVideo | null = configuredVideo(lang)) {
  const t = copies[lang];
  const page = webPage(lang, "/", t.meta.title, t.meta.description);
  const videoNode = video && videoObject(lang, page.url as string, video);
  return graph([
    organization(),
    website(lang),
    {
      "@type": ["WebPage", "FAQPage"],
      ...page,
      about: { "@id": organizationId },
      ...(videoNode && { video: { "@id": videoNode["@id"] } }),
      mainEntity: t.faq.items.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
    ...(videoNode ? [videoNode] : []),
  ]);
}

/** Legal pages: effective and revision dates, plus a "Home > this page" breadcrumb. */
export function legalStructuredData(lang: Lang, path: string, frontmatter: LegalFrontmatter) {
  const page = webPage(lang, path, frontmatter.title, frontmatter.description);
  return graph([
    organization(),
    website(lang),
    {
      "@type": "WebPage",
      ...page,
      datePublished: frontmatter.effective,
      dateModified: frontmatter.updated,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: absolute(localePath(lang, "/")) },
          { "@type": "ListItem", position: 2, name: frontmatter.title, item: page.url },
        ],
      },
    },
  ]);
}

/** Written into <script type="application/ld+json">: escapes < so a </script> in the copy cannot end the script early. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
