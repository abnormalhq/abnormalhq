/**
 * Addresses of the storefront pages: they live on the main site (abnormalhq.com), at its root, so the site address comes from src/data/site.ts.
 * The API is same-origin at /api/onboard/ and /api/shop/: handled by the Worker in production (src/storefront/worker/) and by the mock API under next dev.
 */
import { site } from "../data/site.ts";

/** Site address, used for canonical links and the Markdown versions. */
export const siteUrl = site.url;

/** Absolute path from a path relative to the site root: withBase("zh/shop/") -> /zh/shop/. */
export function withBase(path: string): string {
  return `/${path.replace(/^\/+/, "")}`;
}

/** Full address of a path relative to the site root. */
export function absoluteUrl(path: string): string {
  return new URL(withBase(path), siteUrl).href;
}

/** Prefix of the same-origin API: always the site root, in production and under next dev alike. */
export const apiBase = "";
