/**
 * One catalog request per page view, shared by the home page's pricing section and the hero's address check, which both need it.
 * A failed request is forgotten, so "Try again" asks afresh.
 */
import type { Lang } from "../i18n.ts";
import { getShopCatalog, type ShopCatalog } from "./catalog.ts";

const requests = new Map<Lang, Promise<ShopCatalog>>();

export function sharedCatalog(lang: Lang): Promise<ShopCatalog> {
  let request = requests.get(lang);
  if (!request) {
    request = getShopCatalog(undefined, lang);
    requests.set(lang, request);
    request.catch(() => {
      if (requests.get(lang) === request) requests.delete(lang);
    });
  }
  return request;
}
