/**
 * "Use my own domain" on the account page: the browser client of mail's buyer-domain routes (apps/console/src/lib/shop/buyer-domains.ts
 * and the routes under api/shop/account/domains; "Buyer domains" in docs/storefront-api.md). A buyer whose plan allows it reserves a
 * domain, proves ownership with a TXT record, publishes the mail records and waits for the provider's approval; a live domain then
 * appears among the domains of the account's mailbox groups. Everything here is the buyer's own input or public DNS data of their
 * domain. Kept apart from shop.ts so that only the account page's bundle carries it.
 * This file must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */
import type { Lang } from "../i18n.ts";
import {
  isBoolean,
  isCount,
  isNullableString,
  isString,
  isStrings,
  oneOf,
  record,
  request,
  ShopApiError,
  type SubscriptionState,
} from "./catalog.ts";

/*
 * The enums below are mail's, as data in docs/onboard-contract.json since version 3 (`shop.buyerDomains.statuses`, `phases`,
 * `recordStatuses`, `recordTypes`, `recordPurposes`; mail's packages/core/src/lib/shop/refusals.ts). The parsers accept exactly
 * these, the types are derived from them, and tests/storefront/contract.test.ts checks each list against the contract file,
 * so a status mail adds fails a test here before it fails a page.
 */

/**
 * Where a domain stands: pending (publish the ownership TXT, then verify), provisioning (ownership verified, the mail service
 * is still setting the domain up), review (waiting for the provider's approval), live, or suspended (by the provider).
 */
export const DOMAIN_STATUSES = ["pending", "provisioning", "review", "live", "suspended"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const DNS_RECORD_TYPES = ["MX", "TXT", "CNAME", "SRV"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/** What public DNS says about a record: matched, missing, conflict (something else is published under the name), error (the lookup failed, which is not "missing") or pending. */
export const DNS_RECORD_STATUSES = ["matched", "missing", "conflict", "error", "pending"] as const;
export type DnsRecordStatus = (typeof DNS_RECORD_STATUSES)[number];

/** The purposes mail names today (`shop.buyerDomains.recordPurposes`); a record with one the page does not know is still shown, by its type. */
export const DNS_RECORD_PURPOSES = [
  "ownership",
  "mx",
  "spf",
  "dkim",
  "dmarc",
  "mta-sts-host",
  "mta-sts",
  "tls-rpt",
  "dmarc-report",
  "autoconfig-host",
  "client-discovery",
] as const;
export type DnsRecordPurpose = (typeof DNS_RECORD_PURPOSES)[number];

/** Where the buyer's plans that allow own domains stand (`shop.buyerDomains.phases`): the states of a subscription. */
export const DOMAIN_PHASES: readonly SubscriptionState[] = ["active", "grace", "suspended", "expired"];
const isStatus = oneOf(DOMAIN_STATUSES);
const isPhase = oneOf(DOMAIN_PHASES);
const isRecordType = oneOf(DNS_RECORD_TYPES);
const isRecordStatus = oneOf(DNS_RECORD_STATUSES);

export interface AccountDomain {
  id: string;
  name: string;
  status: DomainStatus;
  /** Where the buyer's plans that allow own domains stand; anything but `active` calls for a renewal. */
  phase: SubscriptionState;
  /** The ownership TXT record to publish while `status` is pending; null afterwards. `name` is the full record name. */
  ownership: { type: "TXT"; name: string; value: string; expiresAt: string } | null;
  verifiedAt: string | null;
  created: string;
}

export interface DomainRecord {
  type: DnsRecordType;
  /** The full record name. */
  name: string;
  /** For SRV: `priority weight port target`, the whole record data. */
  value: string;
  priority?: number;
  /** One of DNS_RECORD_PURPOSES today. Kept as mail sent it: a record with a purpose the page does not know yet is still shown, by its type. */
  purpose: DnsRecordPurpose | (string & {});
  /** false: optional (the DMARC suggestion, the client-discovery records); the domain works without it. */
  required: boolean;
  status: DnsRecordStatus;
  /** What public DNS returned under the name when it is not the expected value. */
  observed: string[];
}

export interface AccountDomains {
  /** How many domains the account's running plans allow; 0 means "Use my own domain" is not part of any of them. */
  limit: number;
  domains: AccountDomain[];
}

export interface DomainCheck {
  domain: AccountDomain;
  /** Empty until ownership is verified and the mail service has set the domain up. */
  records: DomainRecord[];
  /** Every required record matches public DNS. Mailboxes can be set up once the domain is live, whether or not this is true. */
  ready: boolean;
  checkedAt: string;
}

function parseDomain(value: unknown): AccountDomain | null {
  if (
    !record(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !value.name ||
    !isStatus(value.status) ||
    !isPhase(value.phase) ||
    !isNullableString(value.verifiedAt) ||
    !isString(value.created)
  )
    return null;
  const { ownership } = value;
  if (ownership !== null) {
    if (
      !record(ownership) ||
      ownership.type !== "TXT" ||
      !isString(ownership.name) ||
      !ownership.name ||
      !isString(ownership.value) ||
      !ownership.value ||
      !isString(ownership.expiresAt)
    )
      return null;
  }
  return {
    id: value.id,
    name: value.name,
    status: value.status,
    phase: value.phase,
    ownership: ownership
      ? {
          type: "TXT",
          name: ownership.name as string,
          value: ownership.value as string,
          expiresAt: ownership.expiresAt as string,
        }
      : null,
    verifiedAt: value.verifiedAt,
    created: value.created,
  };
}

function parseRecord(value: unknown): DomainRecord | null {
  if (
    !record(value) ||
    !isRecordType(value.type) ||
    !isString(value.name) ||
    !isString(value.value) ||
    !(value.priority === undefined || isCount(value.priority)) ||
    !isString(value.purpose) ||
    !isBoolean(value.required) ||
    !isRecordStatus(value.status) ||
    !isStrings(value.observed)
  )
    return null;
  return {
    type: value.type,
    name: value.name,
    value: value.value,
    ...(value.priority === undefined ? {} : { priority: value.priority }),
    purpose: value.purpose,
    required: value.required,
    status: value.status,
    observed: [...value.observed],
  };
}

function parseCheck(body: unknown): DomainCheck {
  if (!record(body) || !Array.isArray(body.records) || !isBoolean(body.ready) || !isString(body.checkedAt))
    throw new ShopApiError("");
  const domain = parseDomain(body.domain);
  const records = body.records.map(parseRecord);
  if (!domain || !records.every((item): item is DomainRecord => item !== null)) throw new ShopApiError("");
  return { domain, records, ready: body.ready, checkedAt: body.checkedAt };
}

function parseOne(body: unknown): AccountDomain {
  const domain = record(body) ? parseDomain(body.domain) : null;
  if (!domain) throw new ShopApiError("");
  return domain;
}

/**
 * The account's own domains and how many its plans allow. null when signed out (401) and when the backend has no buyer
 * domains (404, a mail before them): the account page then shows nothing about own domains.
 */
export async function getAccountDomains(signal?: AbortSignal, lang?: Lang): Promise<AccountDomains | null> {
  let body: unknown;
  try {
    body = await request("account/domains", undefined, signal, lang);
  } catch (error) {
    if (error instanceof ShopApiError && (error.status === 401 || error.status === 404)) return null;
    throw error;
  }
  if (!record(body) || !isCount(body.limit) || !Array.isArray(body.domains)) throw new ShopApiError("");
  const domains = body.domains.map(parseDomain);
  if (!domains.every((item): item is AccountDomain => item !== null)) throw new ShopApiError("");
  return { limit: body.limit, domains };
}

/** Reserves a domain for the account: the answer carries the ownership TXT record to publish. Nothing is looked up in DNS yet. */
export async function addAccountDomain(domain: string, lang?: Lang): Promise<AccountDomain> {
  return parseOne(await request("account/domains/add", { domain }, undefined, lang));
}

/**
 * "Verify": mail looks the ownership TXT record up and, when it is there, sets the domain up; the answer lists the DNS records to
 * publish with their status. A record that is not visible yet, wrong or expired is a 409 with the reason.
 */
export async function verifyAccountDomain(id: string, lang?: Lang): Promise<DomainCheck> {
  return parseCheck(await request("account/domains/verify", { id }, undefined, lang));
}

/** The records and their status again, without submitting anything: what the page polls. */
export async function checkAccountDomain(id: string, signal?: AbortSignal, lang?: Lang): Promise<DomainCheck> {
  return parseCheck(await request("account/domains/check", { id }, signal, lang));
}

/** A new ownership value for a reservation whose TXT record expired before it was verified (7 days); the old value stops working. */
export async function refreshAccountDomain(id: string, lang?: Lang): Promise<AccountDomain> {
  return parseOne(await request("account/domains/refresh", { id }, undefined, lang));
}

/** Gives a reservation up and frees the name. Only before ownership is verified: afterwards removing the domain is the provider's (409). */
export async function removeAccountDomain(id: string, lang?: Lang): Promise<void> {
  await request("account/domains/remove", { id }, undefined, lang);
}

/**
 * What a buyer types as a domain, as mail will read it: trimmed, lower-case, without a scheme, path, port, leading "@" or
 * trailing dot. mail validates the name; this only keeps a pasted address or URL from being refused for its decoration.
 */
export function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^.*@/, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/**
 * The part of a record name before the domain, which is what many DNS panels ask for ("_mailhq-verification" for
 * "_mailhq-verification.example.com", "@" for the domain itself). The full name is always shown too.
 */
export function recordHost(name: string, domain: string): string {
  const full = name.replace(/\.$/, "").toLowerCase();
  const zone = domain.toLowerCase();
  if (full === zone) return "@";
  return full.endsWith(`.${zone}`) ? full.slice(0, -zone.length - 1) : full;
}

/**
 * Polling `check` after ownership is verified. mail allows 30 checks per 10 minutes per account (each one queries public DNS)
 * and asks for no more than one every 20 seconds, so the page backs off: 20 s, 30 s, 45 s, then every minute, and stops by
 * itself after six rounds (about four and a half minutes), leaving a "Check again" button; DNS changes can take hours, and the
 * provider's review is a person's decision. That is one domain's schedule; the account's limit is kept by the budget below,
 * which all the cards of a page share. Seconds until the automatic check after `done` of them; null when there is none.
 */
export const DOMAIN_POLL_SECONDS: readonly number[] = [20, 30, 45, 60, 60, 60];

export function domainPollDelay(done: number): number | null {
  return Number.isSafeInteger(done) && done >= 0 && done < DOMAIN_POLL_SECONDS.length
    ? DOMAIN_POLL_SECONDS[done]!
    : null;
}

/**
 * mail's limit on `check` is per account, not per domain, and every domain card on the page polls by itself: five domains in
 * review would make 35 checks in under five minutes (one as the page opens and six rounds each) and run into the limit of 30
 * per 10 minutes, which ends the automatic checks with an error. So the cards of one page draw from one budget: at most
 * DOMAIN_CHECK_BUDGET checks in any 10 minutes, a few below mail's 30 to leave room for "Check again" and another tab.
 */
export const DOMAIN_CHECK_BUDGET = 24;
export const DOMAIN_CHECK_WINDOW_SECONDS = 600;

export interface DomainCheckBudget {
  /**
   * Called before a check, with the time in milliseconds. An automatic check is refused (false) while the window is full,
   * and the card then stops its rounds. A check the buyer asked for is never refused here (mail decides), but it is counted.
   */
  take(now: number, automatic: boolean): boolean;
}

export function domainCheckBudget(
  limit: number = DOMAIN_CHECK_BUDGET,
  windowSeconds: number = DOMAIN_CHECK_WINDOW_SECONDS,
): DomainCheckBudget {
  let taken: number[] = [];
  return {
    take(now, automatic) {
      taken = taken.filter((at) => now - at < windowSeconds * 1000);
      if (automatic && taken.length >= limit) return false;
      taken.push(now);
      return true;
    },
  };
}

/**
 * Whether there is nothing left to wait for: a reservation waits for the buyer (publish the TXT, press Verify), a suspended
 * domain for the provider, and a live domain whose required records all match is done. Everything else may still change by
 * itself (the mail service finishing the set-up, DNS spreading, the provider approving).
 */
export function domainSettled(domain: Pick<AccountDomain, "status">, ready: boolean): boolean {
  return domain.status === "pending" || domain.status === "suspended" || (domain.status === "live" && ready);
}

/**
 * The check a domain card makes next without the buyer pressing "Check again", or null when it makes none:
 * - `recovery`: "Verify" was refused because ownership is verified already (another tab, another device), and the card
 *   reads where the domain stands. It is the end of the buyer's own action, so it is made at once, is not an automatic
 *   round (it starts the rounds over) and is never refused by the page's budget, only counted in it: a card still showing
 *   the reservation has no "Check again" to fall back on, and a refused recovery would leave the buyer on the ownership
 *   screen until a reload. It is made even after the automatic checks stopped.
 * - `opening`: the one check as the page opens for a domain past its reservation (its records are not in the list).
 * - `round`: a backed-off automatic round, while there is something left to wait for.
 * `delay` is in seconds; `automatic` and `timed` are what DomainCard's runCheck takes (`timed`: drawn from the shared
 * budget as a check the page started by itself, so refused while the window is full).
 */
export interface DomainNextCheck {
  kind: "recovery" | "opening" | "round";
  delay: number;
  automatic: boolean;
  timed: boolean;
}

export function domainNextCheck(card: {
  status: DomainStatus;
  /** Whether the card has the answer of a check, and whether that answer said every required record matches. */
  checked: boolean;
  ready: boolean;
  /** "Verify" answered `domain_already_verified` and the domain has not been read since. */
  recheck: boolean;
  /** Whether the automatic checks go on (a failed or refused one stops them). */
  auto: boolean;
  busy: boolean;
  /** Automatic rounds made since the buyer last acted. */
  done: number;
}): DomainNextCheck | null {
  if (card.busy) return null;
  if (card.recheck) return { kind: "recovery", delay: 0, automatic: false, timed: false };
  if (!card.auto) return null;
  if (!card.checked && card.status !== "pending") return { kind: "opening", delay: 0, automatic: false, timed: true };
  if (domainSettled(card, card.ready)) return null;
  const delay = domainPollDelay(card.done);
  return delay === null ? null : { kind: "round", delay, automatic: true, timed: true };
}
