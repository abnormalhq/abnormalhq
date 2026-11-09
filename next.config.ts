import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { rehypePlugins, remarkPlugins } from "./src/content/legal/mdx.ts";
import { site } from "./src/data/site.ts";
import { pagePaths, pages, sessionPagePaths } from "./src/lib/pages.ts";

// Paths with an extension (/icon.svg), written the same way as the trailing-slash rule built into Next.js.
const filePath = "/:file((?!\\.well-known(?:/.*)?)(?:[^/]+/)*[^/]+\\.\\w+)";
const onWww = [{ type: "host" as const, value: site.wwwHost }];

const nextVary = "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url";

const nextConfig: NextConfig = {
  // /privacy/ and /zh/ both carry a trailing slash, keeping the paths that were already live.
  trailingSlash: true,
  async redirects() {
    return [
      // www is bound to the same Worker (see wrangler.jsonc) and only redirects to the main domain, keeping path and query string.
      // On the main domain file paths have no trailing slash and page paths do; listing them separately avoids an extra hop.
      { source: filePath, has: onWww, destination: "https://abnormalhq.com/:file", statusCode: 301 },
      { source: "/:path*", has: onWww, destination: "https://abnormalhq.com/:path*/", statusCode: 301 },
      // Next.js has a built-in rule that strips the trailing slash from file paths, but OpenNext does not run built-in rules and only adds the slash to page paths itself.
      { source: `${filePath}/`, destination: "/:file", statusCode: 308 },
      // English used to live under /en/; as the default language it moved to the root. Old URLs (Markdown versions included) redirect permanently, so external links and search results keep working.
      // Only existing pages are listed; unknown /en/ URLs 404 as usual.
      ...pagePaths.flatMap((path) => [
        { source: `/en${path}`, destination: path, statusCode: 301 },
        { source: `/md/en${path}`, destination: `/md${path}`, statusCode: 301 },
      ]),
      // The storefront's session pages had their English version under /en/ on the old onboard site; links mail built then keep working.
      ...sessionPagePaths.map((path) => ({ source: `/en${path}`, destination: path, statusCode: 301 })),
    ];
  },
  async headers() {
    return pages.map((page) => ({
      source: page.url,
      headers: [
        {
          key: "Link",
          value: `</llms.txt>; rel="describedby"; type="text/plain", <${page.markdown}>; rel="alternate"; type="text/markdown"`,
        },
        // This value replaces the Vary that Next.js emits itself, so it has to include the original entries.
        { key: "Vary", value: `${nextVary}, Accept` },
      ],
    }));
  },
  experimental: {
    // English and Chinese each have their own root layout with no shared root, so the 404 has to be src/app/global-not-found.tsx.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      // The Worker runtime cannot read project files with fs, so the theme script is bundled as a string at build time.
      "**/scripts/theme-init.js": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
};

// Turbopack requires plugins to be written as package-name strings; the list is in src/content/legal/mdx.ts, and the tests compile the legal documents with the same one.
const withMDX = createMDX({ options: { remarkPlugins, rehypePlugins } });

export default function config(phase: string): NextConfig {
  return withMDX(
    phase === PHASE_DEVELOPMENT_SERVER
      ? {
          ...nextConfig,
          // The storefront's mock API (src/app/api/*/route.dev.ts, data in src/storefront/mock/) exists only on the dev server: route.dev.ts is an
          // endpoint only while dev.ts is a page extension. The build uses the default extensions, so there it is an ordinary file and no route;
          // in production /api is answered by the Worker (worker.ts) before Next.js.
          pageExtensions: ["tsx", "ts", "dev.ts"],
        }
      : nextConfig,
  );
}
