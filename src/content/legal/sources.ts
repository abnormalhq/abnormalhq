/**
 * Raw text of the legal documents, inlined by raw-loader at bundle time. The Worker runtime cannot read project files with fs,
 * and OpenNext re-executes prerendered routes at runtime, so reading them only at build time is not enough.
 */
import type { Lang } from "@/data/site";
import enPrivacy from "@/content/legal/en/privacy.mdx" with { turbopackLoader: "raw-loader", turbopackAs: "*.js" };
import enTerms from "@/content/legal/en/terms.mdx" with { turbopackLoader: "raw-loader", turbopackAs: "*.js" };
import zhPrivacy from "@/content/legal/zh/privacy.mdx" with { turbopackLoader: "raw-loader", turbopackAs: "*.js" };
import zhTerms from "@/content/legal/zh/terms.mdx" with { turbopackLoader: "raw-loader", turbopackAs: "*.js" };

// src/env.d.ts declares the default export of .mdx as a component; through raw-loader it is actually a string here.
export const legalSources = {
  zh: { "/privacy/": zhPrivacy, "/terms/": zhTerms },
  en: { "/privacy/": enPrivacy, "/terms/": enTerms },
} as unknown as Record<Lang, Record<"/privacy/" | "/terms/", string>>;
