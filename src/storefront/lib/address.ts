/**
 * The address a visitor picked in the address check, carried to where the mailbox is set up so it is not typed again:
 * the check sends it to the shop in the query string (/shop/?address=name@domain, next to ?plan=<id> from a plan card), the shop
 * keeps it in this tab's sessionStorage, and the two forms that create a mailbox (My mailboxes on the account page, the redeem page)
 * start with it filled in. sessionStorage because the way from the shop to those forms leaves the site and comes back (Credit or
 * Stripe's payment page), which a query string does not survive; it lives only in this tab, is never sent anywhere and ends with it.
 * Carrying an address reserves nothing: the forms check it again, and the backend has the final say.
 * This file must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */
import { normalizeUsername, usernameProblem } from "./onboard.ts";

export interface ChosenAddress {
  username: string;
  domain: string;
}

/** Query parameters of the shop page: the plan to point out, and the address to carry. */
export const PLAN_PARAM = "plan";
export const ADDRESS_PARAM = "address";
/** A plan id as mail issues record ids: 15 lowercase letters and digits. */
export const PLAN_ID = /^[a-z0-9]{15}$/;
/** The rough shape of a carried address, for the language toggle's allowlist (src/i18n/paths.ts); parseAddress checks it properly. */
export const ADDRESS_SHAPE = /^[a-z0-9._-]{1,64}@[a-z0-9.-]{1,253}$/;
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const ADDRESS_STORAGE_KEY = "abnormal-address";

/** name@domain with a username the redeem form would accept and a plain host name; anything else is null. */
export function parseAddress(raw: string | null | undefined): ChosenAddress | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || value.indexOf("@") !== at) return null;
  const username = normalizeUsername(value.slice(0, at));
  const domain = value.slice(at + 1);
  return usernameProblem(username) || !DOMAIN.test(domain) ? null : { username, domain };
}

export function formatAddress(address: ChosenAddress): string {
  return `${address.username}@${address.domain}`;
}

/** The plan id in a query value, or null when it is not one. */
export function parsePlan(raw: string | null | undefined): string | null {
  return raw && PLAN_ID.test(raw) ? raw : null;
}

/** The shop's address with a plan to point out and an address to carry: shopHref("/zh/shop/", { plan, address }). */
export function shopHref(shop: string, choice: { plan?: string; address?: ChosenAddress | null }): string {
  const params = new URLSearchParams();
  if (choice.plan && PLAN_ID.test(choice.plan)) params.set(PLAN_PARAM, choice.plan);
  if (choice.address) params.set(ADDRESS_PARAM, formatAddress(choice.address));
  const query = params.toString();
  return query ? `${shop}?${query}` : shop;
}

/** A query string without the carried address, its other values kept: the shop's own once the address is dismissed there. */
export function withoutAddress(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ADDRESS_PARAM);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Storage can be blocked (private modes, embedded contexts): the address is then simply not carried. */
function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Components that show the carried address re-read it when it is kept or forgotten in this page. */
const listeners = new Set<() => void>();

export function subscribeAddress(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The carried address as text ("" when there is none): a stable value for useSyncExternalStore. */
export function storedAddress(): string {
  const address = recallAddress();
  return address ? formatAddress(address) : "";
}

export function rememberAddress(address: ChosenAddress): void {
  try {
    storage()?.setItem(ADDRESS_STORAGE_KEY, formatAddress(address));
  } catch {
    // A full or blocked storage only means the address is typed again later.
  }
  for (const listener of listeners) listener();
}

export function recallAddress(): ChosenAddress | null {
  try {
    return parseAddress(storage()?.getItem(ADDRESS_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function forgetAddress(): void {
  try {
    storage()?.removeItem(ADDRESS_STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
  for (const listener of listeners) listener();
}

/** Once the carried address exists as a mailbox it has done its job: forgets it when it is among the addresses just created. */
export function forgetCreatedAddress(created: readonly string[]): void {
  const address = recallAddress();
  if (address && created.includes(formatAddress(address))) forgetAddress();
}
