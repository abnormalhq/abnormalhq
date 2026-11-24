/**
 * The addresses on a buyer's live domain, managed from the account page: aliases, group addresses and the catch-all. The browser
 * client of mail's routes under api/shop/account/domains (addresses, aliases/*, groups/*, catch-all; apps/console/src/lib/shop/
 * buyer-addresses.ts, "Storefront contract for addresses" in mail's docs/shop.md and "Addresses on a buyer domain" in
 * docs/storefront-api.md). Every rule is mail's: an alias and the catch-all deliver to one of the buyer's mailboxes on that
 * domain, a group only to the buyer's own mailboxes, never to an outside address, and mail refuses anything else in its own words.
 * Kept apart from domains.ts so that only the domain card's code carries it.
 * This file must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */
import type { Lang } from "../i18n.ts";
import { isBoolean, isCount, isNullableString, isString, isStrings, record, request, ShopApiError } from "./catalog.ts";

export interface DomainAlias {
  id: string;
  address: string;
  /** The buyer's mailbox it delivers to. */
  target: string;
  enabled: boolean;
}

export interface DomainGroup {
  id: string;
  address: string;
  description: string;
  members: string[];
}

export interface DomainAddresses {
  domain: { id: string; name: string };
  /** false while the domain is suspended or the buyer's plans have lapsed past grace: shown, not changeable. */
  editable: boolean;
  /** The buyer's mailboxes on this domain: what an alias or the catch-all can deliver to. */
  mailboxes: string[];
  /** What a group address can include: the buyer's mailboxes on this domain (mail gives the same list as `mailboxes`). */
  members: string[];
  aliases: DomainAlias[];
  groups: DomainGroup[];
  /** The mailbox that receives mail for unknown addresses; null when such mail is rejected. */
  catchAll: string | null;
  limits: { aliases: number; groups: number; members: number };
}

function parseAlias(value: unknown): DomainAlias | null {
  if (
    !record(value) ||
    !isString(value.id) ||
    !value.id ||
    !isString(value.address) ||
    !isString(value.target) ||
    !isBoolean(value.enabled)
  )
    return null;
  return { id: value.id, address: value.address, target: value.target, enabled: value.enabled };
}

function parseGroup(value: unknown): DomainGroup | null {
  if (
    !record(value) ||
    !isString(value.id) ||
    !value.id ||
    !isString(value.address) ||
    !isString(value.description) ||
    !isStrings(value.members)
  )
    return null;
  return { id: value.id, address: value.address, description: value.description, members: [...value.members] };
}

function parseAddresses(body: unknown): DomainAddresses {
  if (
    !record(body) ||
    !record(body.domain) ||
    !isString(body.domain.id) ||
    !isString(body.domain.name) ||
    !isBoolean(body.editable) ||
    !isStrings(body.mailboxes) ||
    !isStrings(body.members) ||
    !Array.isArray(body.aliases) ||
    !Array.isArray(body.groups) ||
    !isNullableString(body.catchAll) ||
    !record(body.limits) ||
    !isCount(body.limits.aliases) ||
    !isCount(body.limits.groups) ||
    !isCount(body.limits.members)
  )
    throw new ShopApiError("");
  const aliases = body.aliases.map(parseAlias);
  const groups = body.groups.map(parseGroup);
  if (!aliases.every((item): item is DomainAlias => item !== null)) throw new ShopApiError("");
  if (!groups.every((item): item is DomainGroup => item !== null)) throw new ShopApiError("");
  return {
    domain: { id: body.domain.id, name: body.domain.name },
    editable: body.editable,
    mailboxes: [...body.mailboxes],
    members: [...body.members],
    aliases,
    groups,
    catchAll: body.catchAll,
    limits: { aliases: body.limits.aliases, groups: body.limits.groups, members: body.limits.members },
  };
}

function parseGroupAnswer(body: unknown): DomainGroup {
  const group = record(body) ? parseGroup(body.group) : null;
  if (!group) throw new ShopApiError("");
  return group;
}

/**
 * The addresses on one of the account's live domains. null when mail has no address management (a mail before it answers its
 * 404 page, which the Worker passes on as a JSON 404 with no code): the card then offers none. A domain that is not live yet,
 * or not this account's, is mail's refusal and is thrown like any other.
 */
export async function getDomainAddresses(
  id: string,
  signal?: AbortSignal,
  lang?: Lang,
): Promise<DomainAddresses | null> {
  let body: unknown;
  try {
    body = await request("account/domains/addresses", { id }, signal, lang);
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 404 && !error.code) return null;
    throw error;
  }
  return parseAddresses(body);
}

/** `username@<domain>` delivering to `target`, one of the buyer's mailboxes on the domain. */
export async function addDomainAlias(id: string, username: string, target: string, lang?: Lang): Promise<DomainAlias> {
  const body = await request("account/domains/aliases/add", { id, username, target }, undefined, lang);
  const alias = record(body) ? parseAlias(body.alias) : null;
  if (!alias) throw new ShopApiError("");
  return alias;
}

export async function removeDomainAlias(id: string, aliasId: string, lang?: Lang): Promise<void> {
  await request("account/domains/aliases/remove", { id, aliasId }, undefined, lang);
}

/** `username@<domain>` delivering to every one of `members`, which are the buyer's own mailboxes. */
export async function addDomainGroup(
  id: string,
  username: string,
  members: readonly string[],
  description: string,
  lang?: Lang,
): Promise<DomainGroup> {
  return parseGroupAnswer(
    await request(
      "account/domains/groups/add",
      { id, username, members: [...members], ...(description ? { description } : {}) },
      undefined,
      lang,
    ),
  );
}

/** Changes a group's members to `members` by sending only the difference, which is what mail takes. */
export async function updateDomainGroup(
  id: string,
  group: DomainGroup,
  members: readonly string[],
  lang?: Lang,
): Promise<DomainGroup> {
  const { addMembers, removeMembers } = memberChanges(group.members, members);
  return parseGroupAnswer(
    await request(
      "account/domains/groups/update",
      { id, groupId: group.id, addMembers, removeMembers },
      undefined,
      lang,
    ),
  );
}

export async function removeDomainGroup(id: string, groupId: string, lang?: Lang): Promise<void> {
  await request("account/domains/groups/remove", { id, groupId }, undefined, lang);
}

/** Where mail to unknown addresses on the domain goes: one of the buyer's mailboxes on it, or null to reject it. */
export async function setDomainCatchAll(id: string, destination: string | null, lang?: Lang): Promise<string | null> {
  const body = await request("account/domains/catch-all", { id, destination }, undefined, lang);
  if (!record(body) || !isNullableString(body.catchAll)) throw new ShopApiError("");
  return body.catchAll;
}

/** The members to add and to remove to turn `current` into `next`, compared without regard to case. */
export function memberChanges(
  current: readonly string[],
  next: readonly string[],
): { addMembers: string[]; removeMembers: string[] } {
  const before = new Set(current.map((item) => item.toLowerCase()));
  const after = new Set(next.map((item) => item.toLowerCase()));
  return {
    addMembers: [...after].filter((item) => !before.has(item)),
    removeMembers: [...before].filter((item) => !after.has(item)),
  };
}

/**
 * What a buyer types as the name before "@", as mail will read it: trimmed, lower-case, and without the domain when the whole
 * address was pasted. mail validates the name; this only keeps a pasted address from being refused for its "@<domain>".
 */
export function normalizeLocalPart(raw: string, domain: string): string {
  const value = raw.trim().toLowerCase();
  const suffix = `@${domain.toLowerCase()}`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}
