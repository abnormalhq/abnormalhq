/**
 * schema.org 结构化数据（JSON-LD），帮助搜索引擎与 AI 认出品牌、网站与页面内容。
 * 每页输出一个 @graph：组织与网站在每页都相同，用 @id 互相引用；首页另有常见问题，法律页面另有面包屑与修订日期。
 * 内容都取自界面文案与 frontmatter，不写页面上看不到的信息。
 */
import type { LegalFrontmatter } from "../content/legal/types.ts";
import { configuredVideo, site, type Lang, type PromoVideo } from "../data/site.ts";
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

/** 首页的宣传视频（配置了地址时才有）：名称与简介取自区块文案，封面与发布日期取自配置。 */
function videoObject(lang: Lang, pageUrl: string, video: PromoVideo): Node {
  const t = copies[lang];
  return {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: t.video.title,
    description: t.video.description,
    contentUrl: video.src,
    thumbnailUrl: video.poster,
    uploadDate: video.uploadDate,
    inLanguage: t.htmlLang,
    publisher: { "@id": organizationId },
  };
}

/** 首页：组织、网站，以及带常见问题的页面本身；配置了宣传视频时再加上视频。 */
export function homeStructuredData(lang: Lang, video: PromoVideo | undefined = configuredVideo()) {
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

/** 法律页面：生效与修订日期，以及「首页 › 本页」的面包屑。 */
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

/** 写进 <script type="application/ld+json">：把 < 转义，文案里出现 </script> 也不会提前结束脚本。 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
