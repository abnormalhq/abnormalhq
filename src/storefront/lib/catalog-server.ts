/**
 * The catalog as the pricing page reads it on the Worker, on every request: prices must be the shop's own at the moment the page is
 * served, never the ones of the last deploy, so the page is not prerendered (like the download page and its release list).
 * It asks mail directly through the MAIL Service Binding, the same call the browser's GET /api/shop/catalog ends in, with the page
 * language so plan names come back localised. A good answer is kept for CATALOG_CACHE_SECONDS in the Worker's cache, per language,
 * so a burst of visits is one call to mail; an order is always priced by mail at checkout, whatever a page showed.
 * No answer within the timeout, an error status or an unknown shape gives null, and the page says prices could not be loaded.
 * This file has no dependency on Next.js or the Worker runtime; catalog-live.ts supplies the binding and the cache. Tests run it as is.
 */
import type { Lang } from "../i18n.ts";
import { site } from "../../data/site.ts";
import { parseShopCatalog, type ShopCatalog } from "./catalog.ts";

/** How long a catalog answer may be reused: a price change shows on the pricing page within a minute. */
export const CATALOG_CACHE_SECONDS = 60;
/** The page waits this long for mail at most, then renders without prices. */
export const CATALOG_TIMEOUT_MS = 3_000;

/** The MAIL binding, or anything else that answers the catalog request (the dev server's mock API). */
export interface CatalogSource {
  fetch(request: Request): Promise<Response>;
}

/** The part of the Workers Cache API this uses. */
export interface CatalogCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

/** The cache key is only a name: nothing is served at this address. */
export function catalogCacheKey(lang: Lang): string {
  return `${site.url}/__cache/shop-catalog/${lang}`;
}

async function cached(cache: CatalogCache | undefined, key: string): Promise<ShopCatalog | null> {
  try {
    const hit = await cache?.match(key);
    return hit ? parseShopCatalog(await hit.json()) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the catalog from `source`, addressed at `origin` (mail's own origin, MAIL_ORIGIN; the binding decides where it really goes).
 * Redirects are not followed, as in the Worker's proxy.
 */
export async function readCatalog(
  source: CatalogSource,
  origin: string,
  lang: Lang,
  cache?: CatalogCache,
): Promise<ShopCatalog | null> {
  const key = catalogCacheKey(lang);
  const hit = await cached(cache, key);
  if (hit) return hit;
  let reason = "no answer";
  try {
    const response = await source.fetch(
      new Request(new URL("/api/shop/catalog", origin), {
        headers: { Accept: "application/json", "Accept-Language": lang },
        redirect: "manual",
        signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
      }),
    );
    if (!response.ok) {
      reason = `HTTP ${response.status}`;
      await response.body?.cancel();
      return unread(reason);
    }
    reason = "unknown shape";
    const catalog = parseShopCatalog(await response.json());
    try {
      await cache?.put(
        key,
        Response.json(catalog, { headers: { "Cache-Control": `public, max-age=${CATALOG_CACHE_SECONDS}` } }),
      );
    } catch {
      // The cache is only a saving; the page has its catalog either way.
    }
    return catalog;
  } catch (error) {
    return unread(error instanceof Error && error.name === "TimeoutError" ? "timeout" : reason);
  }
}

/** Only the kind of failure is logged: the catalog is public, but nothing of a request or response belongs in the log. */
function unread(reason: string): null {
  console.warn(`Could not read the shop catalog for the pricing page: ${reason}`);
  return null;
}
