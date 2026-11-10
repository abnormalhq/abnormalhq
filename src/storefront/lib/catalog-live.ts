/**
 * The pricing page's catalog in the place it runs: on the Worker through the MAIL Service Binding and the Worker's cache, under
 * next dev from the dev server's own mock API (src/app/api/shop/…/route.dev.ts). Server-only: it reads the request and the bindings.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import type { Lang } from "../i18n";
import { readCatalog, type CatalogCache, type CatalogSource } from "./catalog-server";
import type { ShopCatalog } from "./catalog";

export async function liveCatalog(lang: Lang): Promise<ShopCatalog | null> {
  if (process.env.NODE_ENV === "development") {
    // next dev has no bindings; the mock API is on this same server. Never used in a build: production only knows the binding.
    const host = (await headers()).get("host");
    // The dev server answers /api/shop/catalog with a redirect to its trailing-slash form, which this one caller may follow.
    const mock = { fetch: (request: Request) => fetch(new Request(request, { redirect: "follow" })) };
    return host ? readCatalog(mock, `http://${host}`, lang) : null;
  }
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { MAIL, MAIL_ORIGIN } = env as { MAIL?: CatalogSource; MAIL_ORIGIN?: string };
    if (!MAIL || !MAIL_ORIGIN) return null;
    // caches.default is the Worker's own cache; lib.dom's CacheStorage does not know it.
    const cache = (globalThis as { caches?: { default?: CatalogCache } }).caches?.default;
    return await readCatalog(MAIL, MAIL_ORIGIN, lang, cache);
  } catch {
    // No Cloudflare context (a plain `next start`): the page renders its "could not load" state.
    return null;
  }
}
