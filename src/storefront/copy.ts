/**
 * The storefront copy of both languages, for server components, metadata, Markdown, structured data and the tests.
 * Client components must not import it, or a page would ship both languages: they read their page's language from the provider the page
 * renders (useOnboardCopy in src/storefront/components/copy/context.tsx).
 */
import { en } from "./i18n.en.ts";
import type { Copy, Lang } from "./i18n.ts";
import { zh } from "./i18n.zh.ts";

export const copy: Record<Lang, Copy> = { zh, en };
