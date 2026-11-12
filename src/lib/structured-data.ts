/**
 * schema.org structured data (JSON-LD), helping search engines and AI recognize the brand, the website and the page content.
 * Each page emits one @graph: the organization and website are the same on every page and reference each other by @id; the home page adds the FAQ, legal pages add breadcrumbs and revision dates.
 * Everything comes from the UI copy and frontmatter; nothing that is not visible on the page is written.
 */
import { helpArticles, helpPath, type HelpArticle } from "../content/help/index.ts";
import type { LegalFrontmatter } from "../content/legal/types.ts";
import { securityContent } from "../content/security/index.ts";
import { developersContent } from "../content/developers/index.ts";
import { absoluteUrl, configuredVideo, site, type Lang, type PromoVideo } from "../data/site.ts";
import { copies } from "../i18n/index.ts";
import { langs, localePath } from "../i18n/paths.ts";
import { plainText, sectionId } from "./docs.ts";
import { socialImage } from "./metadata.ts";
import type { PlanView } from "./pricing.ts";

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

/**
 * The pricing page: the page with a breadcrumb, and one Product with an Offer per plan that can be bought by card.
 * `plans` is what the page shows at this very render (src/lib/pricing.ts), so an offer is never a price the page does not carry.
 * A plan sold only for LDC (Linux DO Credit) gets no Product: schema.org's priceCurrency takes ISO 4217 codes, LDC is not one,
 * and a made-up currency would be a claim search engines cannot read. With the catalog unread or the shop closed there are none.
 */
export function pricingStructuredData(lang: Lang, plans: readonly PlanView[]) {
  const t = copies[lang];
  const page = webPage(lang, "/pricing/", t.pricing.metaTitle, t.pricing.metaDescription);
  const products = plans
    .filter((plan) => plan.offer)
    .map((plan) => ({
      "@type": "Product",
      "@id": `${page.url as string}#plan-${plan.id}`,
      name: plan.name,
      description: plan.description || plan.rows.mailboxes,
      brand: { "@id": organizationId },
      offers: {
        "@type": "Offer",
        // A plan sold per mailbox: the price is for one mailbox, stated as a unit price with how many can be bought, so the
        // offer never reads as the price of the whole plan.
        ...(plan.offer!.seats
          ? {
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: plan.offer!.price,
                priceCurrency: plan.offer!.currency,
                unitText: plan.offer!.seats.unit,
                referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: plan.offer!.seats.unit },
              },
              eligibleQuantity: {
                "@type": "QuantitativeValue",
                minValue: plan.offer!.seats.min,
                maxValue: plan.offer!.seats.max,
                unitText: plan.offer!.seats.unit,
              },
            }
          : { price: plan.offer!.price, priceCurrency: plan.offer!.currency }),
        availability: "https://schema.org/InStock",
        url: absolute(plan.href),
        seller: { "@id": organizationId },
      },
    }));
  return graph([
    organization(),
    website(lang),
    {
      "@type": "WebPage",
      ...page,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: absolute(localePath(lang, "/")) },
          { "@type": "ListItem", position: 2, name: t.pricing.title, item: page.url },
        ],
      },
      ...(products.length > 0 && { mainEntity: products.map((product) => ({ "@id": product["@id"] })) }),
    },
    ...products,
  ]);
}

const breadcrumb = (items: readonly { name: string; url: string }[]): Node => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(({ name, url }, index) => ({ "@type": "ListItem", position: index + 1, name, item: url })),
});

/** The help center's index: a collection page with a breadcrumb, listing the articles the page links to. */
export function helpIndexStructuredData(lang: Lang) {
  const t = copies[lang];
  const page = webPage(lang, "/help/", t.help.metaTitle, t.help.metaDescription);
  return graph([
    organization(),
    website(lang),
    {
      "@type": "CollectionPage",
      ...page,
      breadcrumb: breadcrumb([
        { name: site.name, url: absolute(localePath(lang, "/")) },
        { name: t.help.navLabel, url: page.url as string },
      ]),
      hasPart: helpArticles(lang).map((article) => ({
        "@type": "WebPage",
        name: article.title,
        url: absolute(localePath(lang, helpPath(article.slug))),
      })),
    },
  ]);
}

/**
 * A help article: the page with a "Home > Help center > article" breadcrumb. A section marked `howTo` in the content is a
 * numbered procedure that is on the page step for step, and is described as a schema.org HowTo with those steps as plain
 * text. Sections that are lists of facts get none, and no article is marked as an FAQ: none is written as questions and answers.
 */
export function helpArticleStructuredData(lang: Lang, article: HelpArticle) {
  const t = copies[lang];
  const page = webPage(lang, helpPath(article.slug), article.title, article.summary);
  const url = page.url as string;
  const howTos = article.sections.flatMap((section, index) => {
    const steps = section.howTo ? section.blocks.flatMap((block) => ("ol" in block ? block.ol : [])) : [];
    return steps.length > 0
      ? [
          {
            "@type": "HowTo",
            "@id": `${url}#${sectionId(index)}`,
            name: section.title,
            inLanguage: t.htmlLang,
            step: steps.map((step, position) => ({
              "@type": "HowToStep",
              position: position + 1,
              text: plainText(step),
            })),
          },
        ]
      : [];
  });
  return graph([
    organization(),
    website(lang),
    {
      "@type": "WebPage",
      ...page,
      breadcrumb: breadcrumb([
        { name: site.name, url: absolute(localePath(lang, "/")) },
        { name: t.help.navLabel, url: absolute(localePath(lang, "/help/")) },
        { name: article.title, url },
      ]),
      ...(howTos.length > 0 && { mainEntity: howTos.map((howTo) => ({ "@id": howTo["@id"] })) }),
    },
    ...howTos,
  ]);
}

/** The security and privacy overview: the page, when its statements were last checked, and a breadcrumb. No certification or rating is claimed. */
export function securityStructuredData(lang: Lang) {
  const t = copies[lang];
  const page = webPage(lang, "/security/", t.security.metaTitle, t.security.metaDescription);
  return graph([
    organization(),
    website(lang),
    {
      "@type": "WebPage",
      ...page,
      dateModified: securityContent[lang].reviewed,
      breadcrumb: breadcrumb([
        { name: site.name, url: absolute(localePath(lang, "/")) },
        { name: t.security.navLabel, url: page.url as string },
      ]),
    },
  ]);
}

/** The developer documentation: the page, when it was last checked against mail's API documentation, and a breadcrumb. */
export function developersStructuredData(lang: Lang) {
  const t = copies[lang];
  const page = webPage(lang, "/developers/", t.developers.metaTitle, t.developers.metaDescription);
  return graph([
    organization(),
    website(lang),
    {
      "@type": "WebPage",
      ...page,
      dateModified: developersContent[lang].reviewed,
      breadcrumb: breadcrumb([
        { name: site.name, url: absolute(localePath(lang, "/")) },
        { name: t.developers.navLabel, url: page.url as string },
      ]),
    },
  ]);
}

/** Written into <script type="application/ld+json">: escapes < so a </script> in the copy cannot end the script early. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
