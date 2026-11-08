import type { MetadataRoute } from "next";
import { legalFrontmatters } from "@/content/legal/frontmatter";
import { site } from "@/data/site";
import { copies, defaultLang, langs } from "@/i18n";
import { pageFor, pages } from "@/lib/pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(({ lang, url, path }) => ({
    url: `${site.url}${url}`,
    // Legal pages use the revision date from their frontmatter; the home and download pages have no reliable modification time, and omitting it beats getting it wrong.
    ...(path === "/privacy/" || path === "/terms/" ? { lastModified: legalFrontmatters[lang][path].updated } : {}),
    alternates: {
      languages: {
        ...Object.fromEntries(langs.map((other) => [copies[other].htmlLang, `${site.url}${pageFor(other, path).url}`])),
        "x-default": `${site.url}${pageFor(defaultLang, path).url}`,
      },
    },
  }));
}
