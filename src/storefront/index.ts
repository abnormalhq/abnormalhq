/**
 * What the rest of the site (src/components, src/lib) may use of the storefront: the catalog, the address check and the
 * username rules. Client components import it, so it stays free of server code and of the copy; that is in
 * ./content.ts, and the route-only parts (live catalog, metadata) are in ./server.ts. Pages render the storefront's
 * page components (StorePage, Shop, Onboard, Guide, ...) from ./components/ directly. eslint.config.mjs keeps everything
 * else in src/storefront/ private.
 */

export { normalizeUsername, usernameProblem } from "./lib/onboard.ts";
export { rememberAddress, shopHref, type ChosenAddress } from "./lib/address.ts";
export {
  catalogDomains,
  catalogPlans,
  checkAddress,
  formatCredits,
  formatMoney,
  isSeatProduct,
  seatTotals,
  ShopApiError,
  type SeatProduct,
  type ShopCatalog,
  type ShopProduct,
} from "./lib/catalog.ts";
export { sharedCatalog, subscribeCatalog } from "./lib/catalog-shared.ts";
