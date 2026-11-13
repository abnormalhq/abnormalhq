import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import type { Lang } from "@/data/site";
import { downloadMarkdown, legalMarkdown, llmsFullTxt, pricingMarkdown, stripFrontmatter } from "@/lib/markdown";
import { isPrerendered, pageMarkdown, type LiveData } from "@/lib/page-markdown";
import { pages } from "@/lib/pages";
import { legalFrontmatters } from "@/content/legal/frontmatter";
import { parseReleaseIndex } from "@/lib/releases";
import { catalog, seatCatalog } from "../support/catalog.ts";
import { releaseIndex } from "../support/releases.ts";

// The legal documents only load through the bundler: the sources are inlined by raw-loader and the frontmatter is the MDX loader's
// export. Here the sources are the same files read from disk, and the frontmatter is compiled from them with the site's MDX plugins.
vi.mock("@/content/legal/frontmatter", async () => {
  const { evaluate } = await import("@mdx-js/mdx");
  const runtime = await import("react/jsx-runtime");
  const { rehypePlugins, remarkPlugins } = await import("@/content/legal/mdx");
  const { parseLegalFrontmatter } = await import("@/lib/legal");
  // Plugins by package name, as @next/mdx loads the names in next.config.ts.
  const plugins = (names: readonly string[]) =>
    Promise.all(names.map(async (name) => ((await import(name)) as { default: unknown }).default));
  const options = {
    ...runtime,
    remarkPlugins: await plugins(remarkPlugins),
    rehypePlugins: await plugins(rehypePlugins),
  };
  const load = async (lang: Lang, name: string) => {
    const file = `${lang}/${name}.mdx`;
    const source = readFileSync(`src/content/legal/${file}`, "utf8");
    const { frontmatter } = await evaluate(source, options as Parameters<typeof evaluate>[1]);
    return parseLegalFrontmatter(frontmatter as Record<string, unknown>, file);
  };
  return {
    legalFrontmatters: {
      zh: { "/privacy/": await load("zh", "privacy"), "/terms/": await load("zh", "terms") },
      en: { "/privacy/": await load("en", "privacy"), "/terms/": await load("en", "terms") },
    },
  };
});
vi.mock("@/content/legal/sources", () => {
  const read = (lang: Lang, name: string) => readFileSync(`src/content/legal/${lang}/${name}.mdx`, "utf8");
  return {
    legalSources: {
      zh: { "/privacy/": read("zh", "privacy"), "/terms/": read("zh", "terms") },
      en: { "/privacy/": read("en", "privacy"), "/terms/": read("en", "terms") },
    },
  };
});

// A different catalog per language, so a swapped language would show.
const live: LiveData = {
  catalogs: { en: catalog, zh: seatCatalog },
  releases: parseReleaseIndex(releaseIndex),
};

describe("pageMarkdown renders every page in the list", () => {
  test("each page opens with its own heading and carries no undefined", () => {
    for (const page of pages) {
      const markdown = pageMarkdown(page, live);
      expect(markdown, page.url).toMatch(/^# \S/);
      expect(markdown, page.url).not.toContain("undefined");
    }
  });

  test("the pricing page reads its own language's catalog, and the download page the release list", () => {
    for (const page of pages.filter((page) => !isPrerendered(page))) {
      const other: Lang = page.lang === "en" ? "zh" : "en";
      const markdown = pageMarkdown(page, live);
      if (page.path === "/pricing/") {
        expect(markdown).toBe(pricingMarkdown(page.lang, live.catalogs[page.lang]));
        expect(markdown).not.toBe(pricingMarkdown(page.lang, live.catalogs[other]));
      } else {
        expect(markdown).toBe(downloadMarkdown(page.lang, live.releases));
      }
    }
  });

  test("the pricing page says so when the catalog could not be read", () => {
    const unread: LiveData = { catalogs: { en: null, zh: null }, releases: undefined };
    for (const page of pages.filter((page) => page.path === "/pricing/"))
      expect(pageMarkdown(page, unread)).toBe(pricingMarkdown(page.lang, null));
  });

  test("the legal pages carry their own language's document", () => {
    for (const page of pages) {
      if (page.path !== "/privacy/" && page.path !== "/terms/") continue;
      const name = page.path.slice(1, -1);
      const source = readFileSync(`src/content/legal/${page.lang}/${name}.mdx`, "utf8");
      expect(pageMarkdown(page)).toBe(
        legalMarkdown(page.lang, legalFrontmatters[page.lang][page.path], stripFrontmatter(source)),
      );
    }
  });

  test("without live data, the prerendered pages render and the two live pages refuse", () => {
    for (const page of pages) {
      if (isPrerendered(page)) expect(() => pageMarkdown(page), page.url).not.toThrow();
      else expect(() => pageMarkdown(page), page.url).toThrow(/live catalog/);
    }
  });

  test("llms-full.txt carries every page's real Markdown, each followed by its address", () => {
    const text = llmsFullTxt((page) => pageMarkdown(page, live));
    for (const page of pages) {
      expect(text, page.url).toContain(
        `${pageMarkdown(page, live).trimEnd()}\n\nSource: https://abnormalhq.com${page.url}`,
      );
    }
  });
});
