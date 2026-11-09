import type { Lang } from "../i18n.ts";
import { apiBase } from "../site.ts";

export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  originalPriceCents: number;
  discountPercent: number;
  priceCents: number;
  mailboxCount: number;
  quotaMb: number;
  quotaSupportedByDomain?: Record<string, boolean>;
  codeExpiresDays: number;
  domains: string[];
  /** Subscription period in days; 0 or absent means a one-off purchase and the mailbox never expires. */
  periodDays?: number;
  /** Renewal price per period; 0 means renew at the sale price. */
  renewPriceCents?: number;
  /** Card (Stripe) price in the smallest unit of the shop currency; 0 or absent means it cannot be bought by card. */
  fiatPriceMinor?: number;
}

/** ldc = Linux DO Credit; stripe = card (Stripe Checkout). */
export type ShopPaymentProvider = "ldc" | "stripe";

export type SubscriptionState = "active" | "grace" | "suspended" | "expired";

export interface ShopCatalog {
  available: boolean;
  /** Whether each of the two payment methods is available; old backends that omit it count as LDC only. */
  payment: { ldc: boolean; stripe: { currency: string } | null };
  products: ShopProduct[];
  onboardUrl: string;
  /** Site key when the login form must pass Cloudflare Turnstile; absent means no verification. */
  turnstileSiteKey?: string;
}

export interface PublicShopOrder {
  order: Omit<ShopProduct, "name" | "description"> & {
    productName: string;
    status: "pending" | "paid";
    created: string;
    paidAt: string | null;
    /** purchase = buy a plan and receive a redeem code; renewal = renew an existing subscription. Old backends that omit it count as purchase. */
    kind?: "purchase" | "renewal";
    /** How many periods a renewal order renews. */
    periods?: number;
    /** Which subscription a renewal order renews. */
    subscriptionId?: string | null;
    provider?: ShopPaymentProvider;
    /** Currency of a Stripe order; the amount priceCents is in its smallest unit. */
    currency?: string;
  };
  code: string | null;
  codeStatus: CodeStatus | null;
  onboardUrl: string;
  /**
   * Paid subscription purchase and renewal orders: the subscription's current expiry and the renewal link token. The token can be null (same rule as the account page:
   * Stripe subscriptions, renewal price beyond the payable range), in which case no renewal link is shown; current mail still always issues a token.
   */
  subscription?: {
    currentPeriodEnd: string;
    state: SubscriptionState;
    renewToken: string | null;
    provider?: ShopPaymentProvider;
    autoRenew?: boolean;
  } | null;
}

/** Subscription info read by the renewal page. */
export interface RenewalSummary {
  subscriptionId: string;
  productName: string;
  mailboxCount: number;
  periodDays: number;
  renewPriceCents: number;
  currentPeriodEnd: string;
  state: SubscriptionState;
  mailboxes: string[];
  maxPeriods: number;
  hasContactEmail: boolean;
  /** Stripe subscriptions are charged automatically each period and cannot be renewed manually on the renewal page. */
  provider?: ShopPaymentProvider;
  autoRenew?: boolean;
}

export const SUBSCRIPTION_STATES: readonly SubscriptionState[] = ["active", "grace", "suspended", "expired"];
export const CODE_STATUSES = ["available", "used", "expired", "disabled"] as const;
export const PAYMENT_PROVIDERS: readonly ShopPaymentProvider[] = ["ldc", "stripe"];
export type CodeStatus = (typeof CODE_STATUSES)[number];

export const shopApiRoot = `${apiBase}/api/shop`;

export class ShopApiError extends Error {
  readonly status: number;
  /**
   * A failed response with a JSON body is an answer from this site's Worker or from mail. Cloudflare's own error pages (Worker threw, CPU limit exceeded) are HTML,
   * meaning the request did not get through the Worker's code.
   */
  readonly answered: boolean;

  constructor(message: string, status = 0, answered = false) {
    super(message);
    this.name = "ShopApiError";
    this.status = status;
    this.answered = answered;
  }
}

/*
 * Response validation: every field the components render is checked here one by one and assembled into a new typed object; any unknown shape counts as a failed request,
 * so half-right data never reaches the page (e.g. an unknown currency makes Intl.NumberFormat throw during render and blanks the whole page).
 */

type Fields = Record<string, unknown>;

function record(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function oneOf<T extends string>(values: readonly T[]) {
  return (value: unknown): value is T => (values as readonly unknown[]).includes(value);
}

const isProvider = oneOf(PAYMENT_PROVIDERS);
const isState = oneOf(SUBSCRIPTION_STATES);
const isCodeStatus = oneOf(CODE_STATUSES);
const isKind = oneOf(["purchase", "renewal"] as const);
const isOrderStatus = oneOf(["pending", "paid"] as const);

/** Currency of a Stripe amount: a three-letter lower-case ISO 4217 code (as mail stores it); the empty string for LDC orders. */
function isCurrency(value: unknown): value is string {
  return value === "" || (typeof value === "string" && /^[a-z]{3}$/.test(value));
}

/** A field an old backend may omit: absent, or of the right shape. */
function optional<T>(value: unknown, check: (value: unknown) => value is T): value is T | undefined {
  return value === undefined || check(value);
}

function isNullableCodeStatus(value: unknown): value is CodeStatus | null {
  return value === null || isCodeStatus(value);
}

/** Drops keys whose value is undefined: optional fields an old backend did not return do not appear in the result either. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function validPrice(value: Fields): boolean {
  const { originalPriceCents, discountPercent, priceCents } = value;
  return (
    isCount(originalPriceCents) &&
    originalPriceCents > 0 &&
    isCount(priceCents) &&
    priceCents > 0 &&
    originalPriceCents >= priceCents &&
    isCount(discountPercent) &&
    discountPercent <= 99 &&
    (discountPercent > 0 || originalPriceCents === priceCents)
  );
}

type Entitlements = Omit<ShopProduct, "id" | "name" | "description">;

/** Price and entitlement fields shared by plans and orders. */
function parseEntitlements(value: Fields): Entitlements | null {
  const { quotaSupportedByDomain } = value;
  if (
    !validPrice(value) ||
    !isCount(value.mailboxCount) ||
    !isCount(value.quotaMb) ||
    !isCount(value.codeExpiresDays) ||
    !isStrings(value.domains) ||
    !optional(value.periodDays, isCount) ||
    !optional(value.renewPriceCents, isCount) ||
    !optional(value.fiatPriceMinor, isCount) ||
    !(
      quotaSupportedByDomain === undefined ||
      (record(quotaSupportedByDomain) && Object.values(quotaSupportedByDomain).every(isBoolean))
    )
  )
    return null;
  return {
    originalPriceCents: value.originalPriceCents as number,
    discountPercent: value.discountPercent as number,
    priceCents: value.priceCents as number,
    mailboxCount: value.mailboxCount,
    quotaMb: value.quotaMb,
    quotaSupportedByDomain: quotaSupportedByDomain as Record<string, boolean> | undefined,
    codeExpiresDays: value.codeExpiresDays,
    domains: [...value.domains],
    periodDays: value.periodDays,
    renewPriceCents: value.renewPriceCents,
    fiatPriceMinor: value.fiatPriceMinor,
  };
}

function parseProduct(value: unknown): ShopProduct | null {
  if (!record(value) || !isString(value.id) || !isString(value.name) || !isString(value.description)) return null;
  const entitlements = parseEntitlements(value);
  return entitlements && compact({ id: value.id, name: value.name, description: value.description, ...entitlements });
}

function parseOrder(value: unknown, orderId: string): PublicShopOrder["order"] | null {
  if (
    !record(value) ||
    value.id !== orderId ||
    !isString(value.productName) ||
    !isOrderStatus(value.status) ||
    !isString(value.created) ||
    !isNullableString(value.paidAt) ||
    !optional(value.kind, isKind) ||
    !optional(value.periods, isCount) ||
    !optional(value.subscriptionId, isNullableString) ||
    !optional(value.provider, isProvider) ||
    !optional(value.currency, isCurrency)
  )
    return null;
  const entitlements = parseEntitlements(value);
  if (!entitlements) return null;
  return compact({
    id: orderId,
    productName: value.productName,
    ...entitlements,
    status: value.status,
    created: value.created,
    paidAt: value.paidAt,
    kind: value.kind,
    periods: value.periods,
    subscriptionId: value.subscriptionId,
    provider: value.provider,
    currency: value.currency,
  });
}

function parseOrderSubscription(value: unknown): PublicShopOrder["subscription"] | undefined {
  if (value === undefined || value === null) return null;
  if (
    !record(value) ||
    !isString(value.currentPeriodEnd) ||
    !isState(value.state) ||
    !isNullableString(value.renewToken) ||
    !optional(value.provider, isProvider) ||
    !optional(value.autoRenew, isBoolean)
  )
    return undefined;
  return compact({
    currentPeriodEnd: value.currentPeriodEnd,
    state: value.state,
    renewToken: value.renewToken,
    provider: value.provider,
    autoRenew: value.autoRenew,
  });
}

async function request(path: string, payload?: unknown, signal?: AbortSignal, lang?: Lang): Promise<unknown> {
  const response = await fetch(`${shopApiRoot}/${path}`, {
    method: payload === undefined ? "GET" : "POST",
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(lang ? { "Accept-Language": lang } : {}),
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ShopApiError(
      record(body) && typeof body.error === "string" ? body.error : "",
      response.status,
      record(body),
    );
  }
  return body;
}

export async function getShopCatalog(signal?: AbortSignal, lang?: Lang): Promise<ShopCatalog> {
  const body = await request("catalog", undefined, signal, lang);
  if (!record(body) || !isBoolean(body.available) || !Array.isArray(body.products)) throw new ShopApiError("");
  const products = body.products.map(parseProduct);
  if (!products.every((product): product is ShopProduct => product !== null)) throw new ShopApiError("");
  const payment = record(body.payment) ? body.payment : null;
  // Card payment with a bad currency cannot show a price, so it counts as off.
  const stripe =
    payment && record(payment.stripe) && isCurrency(payment.stripe.currency) && payment.stripe.currency
      ? { currency: payment.stripe.currency }
      : null;
  return {
    available: body.available,
    payment: {
      ldc: payment ? payment.ldc === true : body.available,
      stripe,
    },
    products,
    onboardUrl: isString(body.onboardUrl) ? body.onboardUrl : "",
    ...(isString(body.turnstileSiteKey) && body.turnstileSiteKey.trim()
      ? { turnstileSiteKey: body.turnstileSiteKey.trim() }
      : {}),
  };
}

export async function createShopOrder(
  productId: string,
  lang?: Lang,
  /** Contact email for subscription expiry reminders; the field is not sent when empty. */
  email = "",
  /** Not sent for the default ldc (compatible with old backends that only know LDC). */
  provider: ShopPaymentProvider = "ldc",
): Promise<string> {
  const body = await request(
    "checkout",
    { productId, ...(email ? { email } : {}), ...(provider === "stripe" ? { provider } : {}) },
    undefined,
    lang,
  );
  if (!record(body) || typeof body.orderId !== "string" || !/^[a-z0-9]{15}$/.test(body.orderId))
    throw new ShopApiError("");
  return body.orderId;
}

export async function getShopOrder(orderId: string, signal?: AbortSignal, lang?: Lang): Promise<PublicShopOrder> {
  const body = await request(`orders?id=${encodeURIComponent(orderId)}`, undefined, signal, lang);
  if (!record(body)) throw new ShopApiError("");
  const order = parseOrder(body.order, orderId);
  const subscription = parseOrderSubscription(body.subscription);
  if (
    !order ||
    subscription === undefined ||
    !isNullableString(body.code) ||
    !isNullableCodeStatus(body.codeStatus) ||
    !isString(body.onboardUrl)
  )
    throw new ShopApiError("");
  return { order, code: body.code, codeStatus: body.codeStatus, onboardUrl: body.onboardUrl, subscription };
}

/** Reads a subscription's renewal info with the token from the renewal link. */
export async function getRenewal(token: string, signal?: AbortSignal, lang?: Lang): Promise<RenewalSummary> {
  const body = await request("renewal", { token }, signal, lang);
  if (
    !record(body) ||
    !isString(body.subscriptionId) ||
    !isString(body.productName) ||
    !isString(body.currentPeriodEnd) ||
    !isState(body.state) ||
    !isCount(body.mailboxCount) ||
    !isCount(body.periodDays) ||
    !isCount(body.renewPriceCents) ||
    !isCount(body.maxPeriods) ||
    !isStrings(body.mailboxes) ||
    !isBoolean(body.hasContactEmail) ||
    !optional(body.provider, isProvider) ||
    !optional(body.autoRenew, isBoolean)
  )
    throw new ShopApiError("");
  return compact({
    subscriptionId: body.subscriptionId,
    productName: body.productName,
    mailboxCount: body.mailboxCount,
    periodDays: body.periodDays,
    renewPriceCents: body.renewPriceCents,
    currentPeriodEnd: body.currentPeriodEnd,
    state: body.state,
    mailboxes: [...body.mailboxes],
    maxPeriods: body.maxPeriods,
    hasContactEmail: body.hasContactEmail,
    provider: body.provider,
    autoRenew: body.autoRenew,
  });
}

/** Places a renewal order for a subscription and returns the order number; payment then happens on the order page as usual. */
export async function createRenewalOrder(token: string, periods: number, lang?: Lang, email = ""): Promise<string> {
  const body = await request("renew", email ? { token, periods, email } : { token, periods }, undefined, lang);
  if (!record(body) || typeof body.orderId !== "string" || !/^[a-z0-9]{15}$/.test(body.orderId))
    throw new ShopApiError("");
  return body.orderId;
}

export async function reconcileShopOrder(orderId: string, lang?: Lang): Promise<void> {
  await request("reconcile", { orderId }, undefined, lang);
}

/** Account page: the logged-in buyer's subscriptions and orders (mail's src/lib/shop/customers.ts). */
export interface CustomerAccount {
  email: string;
  /** Whether the account has a login password; old backends without password login omit this field. */
  hasPassword?: boolean;
  /** Linked Google account (the email Google most recently verified), null when none is linked; old backends without Google login omit this field. */
  google?: { email: string } | null;
  subscriptions: {
    id: string;
    productName: string;
    state: SubscriptionState;
    currentPeriodEnd: string;
    periodDays: number;
    renewPriceCents: number;
    mailboxCount: number;
    mailboxes: string[];
    renewToken: string | null;
    provider?: ShopPaymentProvider;
    autoRenew?: boolean;
    currency?: string;
    fiatRenewMinor?: number;
  }[];
  orders: {
    id: string;
    kind: "purchase" | "renewal";
    productName: string;
    priceCents: number;
    periods: number;
    periodDays: number;
    status: "pending" | "paid";
    provider?: ShopPaymentProvider;
    currency?: string;
    created: string;
    paidAt: string | null;
    code: string | null;
    codeStatus: CodeStatus | null;
  }[];
}

type AccountSubscription = CustomerAccount["subscriptions"][number];
type AccountOrder = CustomerAccount["orders"][number];

function parseAccountSubscription(item: unknown): AccountSubscription | null {
  if (
    !record(item) ||
    !isString(item.id) ||
    !isString(item.productName) ||
    !isState(item.state) ||
    !isString(item.currentPeriodEnd) ||
    !isCount(item.periodDays) ||
    !isCount(item.renewPriceCents) ||
    !isCount(item.mailboxCount) ||
    !isStrings(item.mailboxes) ||
    !isNullableString(item.renewToken) ||
    !optional(item.provider, isProvider) ||
    !optional(item.autoRenew, isBoolean) ||
    !optional(item.currency, isCurrency) ||
    !optional(item.fiatRenewMinor, isCount)
  )
    return null;
  return compact({
    id: item.id,
    productName: item.productName,
    state: item.state,
    currentPeriodEnd: item.currentPeriodEnd,
    periodDays: item.periodDays,
    renewPriceCents: item.renewPriceCents,
    mailboxCount: item.mailboxCount,
    mailboxes: [...item.mailboxes],
    renewToken: item.renewToken,
    provider: item.provider,
    autoRenew: item.autoRenew,
    currency: item.currency,
    fiatRenewMinor: item.fiatRenewMinor,
  });
}

function parseAccountOrder(item: unknown): AccountOrder | null {
  if (
    !record(item) ||
    !isString(item.id) ||
    !isKind(item.kind) ||
    !isString(item.productName) ||
    !isCount(item.priceCents) ||
    !isCount(item.periods) ||
    !isCount(item.periodDays) ||
    !isOrderStatus(item.status) ||
    !optional(item.provider, isProvider) ||
    !optional(item.currency, isCurrency) ||
    !isString(item.created) ||
    !isNullableString(item.paidAt) ||
    !isNullableString(item.code) ||
    !isNullableCodeStatus(item.codeStatus)
  )
    return null;
  return compact({
    id: item.id,
    kind: item.kind,
    productName: item.productName,
    priceCents: item.priceCents,
    periods: item.periods,
    periodDays: item.periodDays,
    status: item.status,
    provider: item.provider,
    currency: item.currency,
    created: item.created,
    paidAt: item.paidAt,
    code: item.code,
    codeStatus: item.codeStatus,
  });
}

function parseAccount(value: unknown): CustomerAccount | null {
  if (
    !record(value) ||
    !isString(value.email) ||
    !optional(value.hasPassword, isBoolean) ||
    !(value.google === undefined || value.google === null || (record(value.google) && isString(value.google.email))) ||
    !Array.isArray(value.subscriptions) ||
    !Array.isArray(value.orders)
  )
    return null;
  const subscriptions = value.subscriptions.map(parseAccountSubscription);
  const orders = value.orders.map(parseAccountOrder);
  if (!subscriptions.every((item) => item !== null) || !orders.every((item) => item !== null)) return null;
  return compact({
    email: value.email,
    hasPassword: value.hasPassword,
    google:
      value.google === undefined ? undefined : value.google === null ? null : { email: value.google.email as string },
    subscriptions: subscriptions as AccountSubscription[],
    orders: orders as AccountOrder[],
  });
}

/** Reads the account; returns null when logged out (401), which makes the page show the login form. */
export async function getAccount(signal?: AbortSignal, lang?: Lang): Promise<CustomerAccount | null> {
  try {
    const account = parseAccount(await request("account", undefined, signal, lang));
    if (!account) throw new ShopApiError("");
    return account;
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 401) return null;
    throw error;
  }
}

/** Turnstile action of the login form: mail only accepts tokens issued for this form (turnstile.actions in docs/onboard-contract.json). */
export const LOGIN_TURNSTILE_ACTION = "shop-login";

/** Sends a login email to this address; when the backend has human verification on it must carry a Turnstile token (action LOGIN_TURNSTILE_ACTION). */
export async function requestLogin(email: string, lang?: Lang, turnstileToken = ""): Promise<void> {
  await request("account/login", { email, ...(turnstileToken ? { turnstileToken } : {}) }, undefined, lang);
}

/** Which mailbox a login link belongs to, and whether it is a registration confirmation link (register); old backends omit register, so it counts as a plain login link. */
export interface PeekedLogin {
  email: string;
  register: boolean;
  /** Password reset link after a forgotten password (?reset=...): can only set a new password, not log in directly. */
  reset: boolean;
}

/**
 * Which mailbox a login link belongs to (read-only, does not spend the link): the account page uses it to ask "Log in as ...?" or "Confirm registration for ...?", and hands it to verifyLogin only after the buyer confirms.
 * An invalid, expired or used link is a 400; old backends without this endpoint answer other errors.
 */
export async function peekLogin(token: string, signal?: AbortSignal, lang?: Lang): Promise<PeekedLogin> {
  const body = await request("account/peek", { token }, signal, lang);
  if (
    !record(body) ||
    !isString(body.email) ||
    !body.email ||
    !optional(body.register, isBoolean) ||
    !optional(body.reset, isBoolean)
  )
    throw new ShopApiError("");
  return { email: body.email, register: body.register === true, reset: body.reset === true };
}

/**
 * peekLogin for the confirmation dialog: temporary failures (offline, rate limit, backend 5xx, and old backends without peek) are asked again after a moment,
 * because the mailbox in the dialog is the main clue for spotting a login link planted by someone else. A 400 (invalid link) and malformed answers are final and not retried.
 */
export async function peekLoginWithRetry(
  token: string,
  signal?: AbortSignal,
  lang?: Lang,
  pauseMs = 1000,
): Promise<PeekedLogin> {
  try {
    return await peekLogin(token, signal, lang);
  } catch (error) {
    if (signal?.aborted || !transientFailure(error)) throw error;
    await pause(pauseMs, signal);
    return peekLogin(token, signal, lang);
  }
}

/** A failure that may succeed on retry: the request never arrived (fetch TypeError), rate limited or a server fault. */
function transientFailure(error: unknown): boolean {
  if (error instanceof ShopApiError) return error.status === 429 || error.status >= 500;
  return error instanceof TypeError;
}

/** Waits ms milliseconds; ends at once with the abort reason when signal aborts. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const abort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Exchanges the token from a login link for a session cookie; returns the logged-in email and how many orders were attached to the account this time. */
export async function verifyLogin(token: string, lang?: Lang): Promise<{ email: string; claimed: number }> {
  const body = await request("account/verify", { token }, undefined, lang);
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Registers with email and password: mail sends a confirmation email to this address, and the account exists and the password takes effect only after the buyer opens the link inside (the same confirmation page as login links).
 * The answer is the same when the email is already registered (so who has an account is not revealed), and confirming then amounts to a password reset. Shares the Turnstile widget and action with the login form.
 */
export async function registerAccount(
  email: string,
  password: string,
  lang?: Lang,
  turnstileToken = "",
): Promise<void> {
  await request(
    "account/register",
    { email, password, ...(turnstileToken ? { turnstileToken } : {}) },
    undefined,
    lang,
  );
}

/**
 * Forgot password: sends a password reset email to this address (if it is registered; otherwise mail sends nothing but answers the same, so who has an account is not revealed).
 * Shares the Turnstile widget and action with the login form.
 */
export async function requestPasswordReset(email: string, lang?: Lang, turnstileToken = ""): Promise<void> {
  await request("account/forgot", { email, ...(turnstileToken ? { turnstileToken } : {}) }, undefined, lang);
}

/**
 * Sets a new password with the token from a reset link: on success this account is logged out in every browser and the current browser gets a new login (the Worker rebuilds the session cookie).
 * An invalid, expired or used link is a 400.
 */
export async function resetPassword(
  token: string,
  password: string,
  lang?: Lang,
): Promise<{ email: string; claimed: number }> {
  const body = await request("account/reset", { token, password }, undefined, lang);
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Starts Google login: mail sets a 10-minute signed cookie on this browser (sent only to account/google) and returns the address of Google's consent page, which the page jumps to.
 * link: linking Google from the account page while logged in; on return that Google account is linked to the current account instead of logging in with it.
 * Only Google's consent page is accepted (the development mock gives this site's address); any other address counts as a bad response, so the buyer is never sent elsewhere.
 */
export async function startGoogleLogin(lang: Lang, link = false): Promise<string> {
  const body = await request("account/google/start", link ? { lang, link: true } : { lang }, undefined, lang);
  if (!record(body) || !isString(body.url)) throw new ShopApiError("");
  let target: URL;
  try {
    target = new URL(body.url, window.location.origin);
  } catch {
    throw new ShopApiError("");
  }
  const google = target.origin === "https://accounts.google.com" && target.pathname.startsWith("/o/oauth2/");
  if (!google && target.origin !== window.location.origin) throw new ShopApiError("");
  return target.href;
}

/**
 * After Google sends the browser back to the account page (?code=...&state=...), hands both to mail: it matches this browser's cookie, verifies the Google identity and logs in,
 * and the Worker installs the account session cookie. lang is the page language when login started (Google knows one callback address, always the Chinese page); created means a new account was opened,
 * linked that Google was linked this time (an existing account linked automatically on login, or linked from the account page).
 */
export async function finishGoogleLogin(
  code: string,
  state: string,
  lang?: Lang,
): Promise<{ email: string; claimed: number; created: boolean; linked: boolean; lang: Lang }> {
  const body = await request("account/google", { code, state }, undefined, lang);
  if (
    !record(body) ||
    !isString(body.email) ||
    !isCount(body.claimed) ||
    !isBoolean(body.created) ||
    !optional(body.linked, isBoolean) ||
    (body.lang !== "zh" && body.lang !== "en")
  )
    throw new ShopApiError("");
  return {
    email: body.email,
    claimed: body.claimed,
    created: body.created,
    linked: body.linked === true,
    lang: body.lang,
  };
}

/** Unlinks Google; password and email link login keep working. */
export async function unlinkGoogle(lang?: Lang): Promise<void> {
  await request("account/google/unlink", {}, undefined, lang);
}

/** Login password length (in characters), the same as mail's CUSTOMER_PASSWORD_MIN / MAX. */
export const ACCOUNT_PASSWORD_MIN = 8;
export const ACCOUNT_PASSWORD_MAX = 128;

/**
 * Logs in with email and password; on success the Worker installs the account session cookie. Returns the logged-in email and how many orders were attached to the account this time.
 * No such account, no password set and wrong password are all the same 401. Uses the same Turnstile action as the login link form (LOGIN_TURNSTILE_ACTION).
 */
export async function passwordLogin(
  email: string,
  password: string,
  lang?: Lang,
  turnstileToken = "",
): Promise<{ email: string; claimed: number }> {
  const body = await request(
    "account/password-login",
    { email, password, ...(turnstileToken ? { turnstileToken } : {}) },
    undefined,
    lang,
  );
  if (!record(body) || !isString(body.email) || !isCount(body.claimed)) throw new ShopApiError("");
  return { email: body.email, claimed: body.claimed };
}

/**
 * Sets or changes the login password. Within 10 minutes of logging in through a login link the current password can be left out (first-time setup and forgotten passwords rely on this);
 * otherwise the current password is required and a wrong one is a 403. On success this account is logged out in other browsers while the current browser stays logged in.
 */
export async function setAccountPassword(password: string, currentPassword = "", lang?: Lang): Promise<void> {
  await request("account/password", { password, ...(currentPassword ? { currentPassword } : {}) }, undefined, lang);
}

/**
 * Logs out. Every logout request this site's Worker forwards to mail clears the session cookie, even when mail fails (5xx),
 * so a 5xx answered by the Worker (JSON body) also counts as logged out; a request that never arrived (offline), a rejection (4xx), or Cloudflare's own error page
 * (the Worker did not finish, the cookie is still there) report an error as usual.
 */
export async function logoutAccount(lang?: Lang): Promise<void> {
  try {
    await request("account/logout", {}, undefined, lang);
  } catch (error) {
    if (!(error instanceof ShopApiError && error.status >= 500 && error.answered)) throw error;
  }
}

/**
 * Paying a card order on the order page with Stripe Elements (mail's pay/stripe):
 * - open: initialize Stripe.js with clientSecret and publishableKey and embed the payment form in the page;
 * - hosted: no publishable key is configured (or the backend is too old, or the Worker does not know this endpoint): use the "Pay" form that goes to Stripe's hosted page;
 * - paid: already paid (possibly completed in this very step); processing: the buyer already paid and the bank debit is on its way, nothing more to pay.
 */
export type StripePaymentStart =
  { status: "open"; clientSecret: string; publishableKey: string } | { status: "hosted" | "paid" | "processing" };

/**
 * A Checkout Session's client secret: the session id, `_secret_`, then an opaque part Stripe percent-encodes (live secrets
 * carry `%2F`, `%3F` and the like), so the opaque part takes the URL-safe and percent-encoding characters too.
 */
const CHECKOUT_CLIENT_SECRET = /^cs_(?:test|live)_[A-Za-z0-9]{1,250}_secret_[A-Za-z0-9%_+/=-]{1,1000}$/;

export async function startStripePayment(orderId: string, lang?: Lang): Promise<StripePaymentStart> {
  let body: unknown;
  try {
    body = await request("pay/stripe", { orderId, ...(lang ? { lang } : {}) }, undefined, lang);
  } catch (error) {
    // An old Worker or mail without this endpoint: the hosted page as before. Other errors (order not found, rate limited) are thrown as usual.
    if (error instanceof ShopApiError && error.status === 404 && !error.message.trim()) return { status: "hosted" };
    throw error;
  }
  if (!record(body)) throw new ShopApiError("");
  if (body.status === "hosted" || body.status === "paid" || body.status === "processing")
    return { status: body.status };
  if (
    body.status === "open" &&
    isString(body.clientSecret) &&
    CHECKOUT_CLIENT_SECRET.test(body.clientSecret) &&
    isString(body.publishableKey) &&
    /^pk_(test|live)_[A-Za-z0-9]{10,250}$/.test(body.publishableKey)
  )
    return { status: "open", clientSecret: body.clientSecret, publishableKey: body.publishableKey };
  throw new ShopApiError("");
}

/** Opens the customer portal for the buyer's own Stripe subscription (change card, cancel or resume auto-renewal) and returns Stripe's page address. */
export async function openBillingPortal(subscriptionId: string, lang?: Lang): Promise<string> {
  const body = await request("account/portal", { subscriptionId }, undefined, lang);
  if (!record(body) || typeof body.url !== "string" || !/^https:\/\/billing\.stripe\.com\//.test(body.url))
    throw new ShopApiError("");
  return body.url;
}

/** Card amount: the smallest unit written with the currency symbol; an unknown currency falls back to "amount + code" so rendering does not throw. */
export function formatMoney(minor: number, currency: string, lang?: Lang): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en" : "zh-CN", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`.trim();
  }
}

export function formatCredits(cents: number): string {
  return (cents / 100).toFixed(2);
}

/* ---------------------------------------------------------------------------
 * Mailbox management (mail's src/lib/shop/customer-mailboxes.ts): the mailboxes activated with the redeem codes of the buyer's paid orders.
 * ------------------------------------------------------------------------- */

export type AccountMailboxStatus = "active" | "disabled";

export interface MailServer {
  host: string;
  port: number;
  security: string;
}

export interface AccountMailbox {
  id: string;
  email: string;
  status: AccountMailboxStatus;
  /** MB; 0 means unlimited; null when never synced. */
  quotaMb: number | null;
  usageMb: number | null;
  created: string;
}

/** One paid purchase order and the mailboxes activated with its redeem code. */
export interface AccountMailboxGroup {
  orderId: string;
  productName: string;
  code: string;
  codeStatus: CodeStatus;
  usesLeft: number;
  mailboxLimit: number;
  codeExpires: string | null;
  /** Domains a new mailbox can be activated on now; empty when none can (used up, expired, disabled, subscription suspended). */
  domains: string[];
  /** The subscription is suspended or pending reclamation: read-only until renewed. */
  locked: boolean;
  mailboxes: AccountMailbox[];
}

export interface AccountMailboxes {
  groups: AccountMailboxGroup[];
  servers: Record<string, { imap: MailServer | null; smtp: MailServer | null }>;
  webmail: string | null;
}

function isSize(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function parseServer(value: unknown): MailServer | null | undefined {
  if (value === null) return null;
  if (!record(value) || !isString(value.host) || !isCount(value.port) || !isString(value.security)) return undefined;
  return { host: value.host, port: value.port, security: value.security };
}

function parseAccountMailbox(value: unknown): AccountMailbox | null {
  if (
    !record(value) ||
    !isString(value.id) ||
    !isString(value.email) ||
    (value.status !== "active" && value.status !== "disabled") ||
    !isSize(value.quotaMb) ||
    !isSize(value.usageMb) ||
    !isString(value.created)
  )
    return null;
  return {
    id: value.id,
    email: value.email,
    status: value.status,
    quotaMb: value.quotaMb,
    usageMb: value.usageMb,
    created: value.created,
  };
}

function parseMailboxGroup(value: unknown): AccountMailboxGroup | null {
  if (
    !record(value) ||
    !isString(value.orderId) ||
    !isString(value.productName) ||
    !isString(value.code) ||
    !isCodeStatus(value.codeStatus) ||
    !isCount(value.usesLeft) ||
    !isCount(value.mailboxLimit) ||
    !isNullableString(value.codeExpires) ||
    !isStrings(value.domains) ||
    !isBoolean(value.locked) ||
    !Array.isArray(value.mailboxes)
  )
    return null;
  const mailboxes = value.mailboxes.map(parseAccountMailbox);
  if (!mailboxes.every((item) => item !== null)) return null;
  return {
    orderId: value.orderId,
    productName: value.productName,
    code: value.code,
    codeStatus: value.codeStatus,
    usesLeft: value.usesLeft,
    mailboxLimit: value.mailboxLimit,
    codeExpires: value.codeExpires,
    domains: [...value.domains],
    locked: value.locked,
    mailboxes: mailboxes as AccountMailbox[],
  };
}

function parseAccountMailboxes(value: unknown): AccountMailboxes | null {
  if (!record(value) || !Array.isArray(value.groups) || !record(value.servers) || !isNullableString(value.webmail))
    return null;
  const groups = value.groups.map(parseMailboxGroup);
  if (!groups.every((item) => item !== null)) return null;
  const servers: AccountMailboxes["servers"] = {};
  for (const [domain, entry] of Object.entries(value.servers)) {
    if (!record(entry)) return null;
    const imap = parseServer(entry.imap);
    const smtp = parseServer(entry.smtp);
    if (imap === undefined || smtp === undefined) return null;
    servers[domain] = { imap, smtp };
  }
  return { groups: groups as AccountMailboxGroup[], servers, webmail: value.webmail };
}

/** Reads mailbox management; returns null when logged out (401). */
export async function getAccountMailboxes(signal?: AbortSignal, lang?: Lang): Promise<AccountMailboxes | null> {
  try {
    const mailboxes = parseAccountMailboxes(await request("account/mailboxes", undefined, signal, lang));
    if (!mailboxes) throw new ShopApiError("");
    return mailboxes;
  } catch (error) {
    if (error instanceof ShopApiError && error.status === 401) return null;
    throw error;
  }
}

/** Activates a mailbox directly with an order's redeem code: same rules as the redeem page; returns the address and the mail servers. */
export async function createAccountMailbox(
  input: { orderId: string; domain: string; username: string; password: string },
  lang?: Lang,
): Promise<{ email: string; imap: MailServer | null; smtp: MailServer | null; webmail: string | null }> {
  const body = await request("account/mailboxes/create", input, undefined, lang);
  if (!record(body) || !isString(body.email) || !isNullableString(body.webmail)) throw new ShopApiError("");
  const imap = parseServer(body.imap);
  const smtp = parseServer(body.smtp);
  if (imap === undefined || smtp === undefined) throw new ShopApiError("");
  return { email: body.email, imap, smtp, webmail: body.webmail };
}

/** Sets a new password on one of the buyer's mailboxes: webmail and client logins using the old password stop working. */
export async function setAccountMailboxPassword(mailboxId: string, password: string, lang?: Lang): Promise<void> {
  await request("account/mailboxes/password", { mailboxId, password }, undefined, lang);
}

/** Suspends or resumes one of the buyer's mailboxes. */
export async function setAccountMailboxStatus(
  mailboxId: string,
  status: AccountMailboxStatus,
  lang?: Lang,
): Promise<void> {
  await request("account/mailboxes/status", { mailboxId, status }, undefined, lang);
}

/** Deletes one of the buyer's mailboxes with all its mail (irreversible); confirm must repeat the address; the quota goes back to the redeem code. */
export async function deleteAccountMailbox(mailboxId: string, confirm: string, lang?: Lang): Promise<void> {
  await request("account/mailboxes/delete", { mailboxId, confirm }, undefined, lang);
}
