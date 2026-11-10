/**
 * One catalog request per page view, shared by the home page's pricing section and the hero's address check, which both need it.
 * A failed request is forgotten, so "Try again" asks afresh, and whoever reads the catalog hears of the answer (subscribeCatalog):
 * a retry started by one of them recovers the other too.
 * A good answer is shared for a minute only, as on the pricing page (catalog-server.ts): this module lives as long as the tab does,
 * across client-side navigation, and a home page opened again later must not show the prices of the first visit.
 */
import type { Lang } from "../i18n.ts";
import { getShopCatalog, type ShopCatalog } from "./catalog.ts";

export const SHARED_CATALOG_SECONDS = 60;

const requests = new Map<Lang, { request: Promise<ShopCatalog>; at: number }>();
const listeners = new Map<Lang, Set<(catalog: ShopCatalog) => void>>();

export function sharedCatalog(lang: Lang): Promise<ShopCatalog> {
  const shared = requests.get(lang);
  if (shared && Date.now() - shared.at < SHARED_CATALOG_SECONDS * 1000) return shared.request;
  const request = getShopCatalog(undefined, lang);
  requests.set(lang, { request, at: Date.now() });
  request.then(
    (catalog) => {
      for (const listener of listeners.get(lang) ?? []) listener(catalog);
    },
    () => {
      if (requests.get(lang)?.request === request) requests.delete(lang);
    },
  );
  return request;
}

/** Every catalog read from now on in this language, whoever asked for it: after a failed first request, the answer of a retry. */
export function subscribeCatalog(lang: Lang, onCatalog: (catalog: ShopCatalog) => void): () => void {
  const set = listeners.get(lang) ?? new Set();
  listeners.set(lang, set);
  set.add(onCatalog);
  return () => void set.delete(onCatalog);
}
