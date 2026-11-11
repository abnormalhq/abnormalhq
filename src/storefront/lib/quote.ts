/**
 * What an order would cost before it exists: the browser client of mail's POST /api/shop/quote (`shop.quote` in
 * docs/onboard-contract.json; "Seat plans" in docs/storefront-api.md), and the board the pages keep their quotes on.
 *
 * mail prices an order: a seat plan's discount is taken off the whole order and rounded once, each way of paying has its own
 * price, and the most one order can charge is mail's to say. With a quote the pages show mail's numbers and work out no money
 * themselves. A mail before the endpoint answers 404: the pages then show the estimate they always showed (seatOrderPrice
 * and seatCardPrice in catalog.ts), and they show the same estimate while a quote is on its way or cannot be had.
 * This file does not depend on the DOM and must not use TypeScript syntax Node cannot run directly; tests run it as is.
 */
import type { Lang } from "../i18n.ts";
import {
  isBoolean,
  isCount,
  isCurrency,
  isString,
  oneOf,
  parseRefusal,
  PLAN_KINDS,
  record,
  request,
  SEAT_MAX,
  seatOrderPrice,
  ShopApiError,
  type PlanKind,
  type ShopPaymentProvider,
} from "./catalog.ts";

/**
 * What is asked: a plan, the ways of paying to price it for and, for a seat plan, how many seats (0 for a fixed plan, which
 * is sold whole). One ask is one request, however many ways of paying it names: mail prices them all in one answer.
 */
export interface QuoteAsk {
  productId: string;
  /** The ways of paying on offer for the plan, each once and at least one; the answer has one price per entry. */
  providers: readonly ShopPaymentProvider[];
  quantity: number;
  /**
   * A discount code to price the order with. Every quote that carries one is a guess against mail's limit on code guesses
   * (10 per 10 minutes per source IP, shared with checkout), so the pages send none with the quotes they ask by themselves.
   */
  coupon?: string;
}

/** A discount code on a quote: null when none was sent, `valid: false` when it cannot be used for this order (one answer for every reason). */
export type QuoteCoupon =
  null | { valid: false } | { valid: true; code: string; discountCents: number; firstPeriodOnly: boolean };

/**
 * One way of paying of mail's quote, with what the quote says for every way laid next to it: the figures one total on a
 * page is drawn from. Amounts are hundredths of an LDC, or the smallest unit of `currency` for a card.
 */
export interface PurchaseQuote {
  productId: string;
  planKind: PlanKind;
  provider: ShopPaymentProvider;
  /** "" for LDC. */
  currency: string;
  /** Seats of a seat plan; 1 for a fixed plan. */
  quantity: number;
  /** The range `quantity` may be in right now: the plan's seat range, 1 and 1 for a fixed plan. */
  minQuantity: number;
  maxQuantity: number;
  /** One seat (or the fixed plan) before and after the plan's own discount. `quantity` times the second is NOT the total. */
  unitOriginalPriceCents: number;
  unitPriceCents: number;
  /** The order before the plan's discount (an order's `originalPriceCents`). */
  subtotalCents: number;
  discountPercent: number;
  /** What the plan's discount takes off the subtotal. */
  planDiscountCents: number;
  /** The price before a discount code. */
  basePriceCents: number;
  coupon: QuoteCoupon;
  /** What the buyer pays now (an order's `priceCents`). */
  totalCents: number;
  /** The subscription period in days; 0 for a one-time purchase. */
  periodDays: number;
  /** What each later period costs for this quantity; 0 for a one-time purchase. A code never applies to it. */
  renewPriceCents: number;
}

/**
 * A way of paying that was asked about and cannot take the order (`available: false` in mail's answer): the coded refusal
 * a quote for that way alone would have got (`product_unavailable`, or `seat_total_too_large` with `maxTotalCents`).
 */
export interface QuoteRefusal {
  provider: ShopPaymentProvider;
  code: string;
  /** mail's text, in the page language where mail sent it. */
  message: string;
  details: Readonly<Record<string, number>>;
}

/**
 * mail's answer to one ask (PurchaseQuote in its apps/console/src/lib/shop/quote.ts): what is the same whichever way the
 * order is paid, and for each way asked about its price or why it cannot take the order.
 */
export interface PlanQuote {
  productId: string;
  planKind: PlanKind;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  periodDays: number;
  /** One entry per way of paying asked about, in the order asked. */
  prices: readonly (({ available: true } & PurchaseQuote) | ({ available: false } & QuoteRefusal))[];
}

const isProvider = oneOf(["ldc", "stripe"] as const);
const isPlanKind = oneOf(PLAN_KINDS);

function parseQuoteCoupon(value: unknown): QuoteCoupon | undefined {
  if (value === null) return null;
  if (!record(value) || !isBoolean(value.valid)) return undefined;
  if (!value.valid) return { valid: false };
  if (
    !isString(value.code) ||
    !value.code ||
    !isCount(value.discountCents) ||
    value.discountCents < 1 ||
    !isBoolean(value.firstPeriodOnly)
  )
    return undefined;
  return {
    valid: true,
    code: value.code,
    discountCents: value.discountCents,
    firstPeriodOnly: value.firstPeriodOnly,
  };
}

/** What a quote says for every way of paying, checked. */
type QuoteShared = Pick<
  PurchaseQuote,
  "productId" | "planKind" | "quantity" | "minQuantity" | "maxQuantity" | "periodDays"
>;

/** One priced entry of `prices`, for the way of paying asked at its place. */
function parseQuotePrice(
  entry: Record<string, unknown>,
  shared: QuoteShared,
  provider: ShopPaymentProvider,
  ask: QuoteAsk,
): PurchaseQuote {
  const {
    currency,
    unitOriginalPriceCents,
    unitPriceCents,
    subtotalCents,
    discountPercent,
    planDiscountCents,
    basePriceCents,
    totalCents,
    renewPriceCents,
  } = entry;
  const coupon = parseQuoteCoupon(entry.coupon);
  if (
    !isCurrency(currency) ||
    (provider === "stripe") !== Boolean(currency) ||
    ![
      unitOriginalPriceCents,
      unitPriceCents,
      subtotalCents,
      discountPercent,
      planDiscountCents,
      basePriceCents,
      totalCents,
      renewPriceCents,
    ].every(isCount) ||
    coupon === undefined
  )
    throw new ShopApiError("");
  const [subtotal, planDiscount, base, total] = [
    subtotalCents,
    planDiscountCents,
    basePriceCents,
    totalCents,
  ] as number[];
  const discount = coupon?.valid ? coupon.discountCents : 0;
  if (
    (unitPriceCents as number) < 1 ||
    (unitOriginalPriceCents as number) < (unitPriceCents as number) ||
    (discountPercent as number) > 99 ||
    base! < 1 ||
    subtotal! < base! ||
    planDiscount !== subtotal! - base! ||
    total! < 1 ||
    total !== base! - discount ||
    // A code was sent or it was not: the answer says which.
    (coupon === null) !== !ask.coupon
  )
    throw new ShopApiError("");
  return {
    ...shared,
    provider,
    currency,
    unitOriginalPriceCents: unitOriginalPriceCents as number,
    unitPriceCents: unitPriceCents as number,
    subtotalCents: subtotal!,
    discountPercent: discountPercent as number,
    planDiscountCents: planDiscount!,
    basePriceCents: base!,
    coupon,
    totalCents: total!,
    renewPriceCents: renewPriceCents as number,
  };
}

/**
 * Checks a quote and builds the typed one; throws ShopApiError on anything else. Like every answer the pages render, a
 * half-right quote never reaches them: it must be for the plan and quantity asked, `prices` must have exactly one entry
 * per way of paying asked and in that order, each price's amounts must add up the way mail's document says they do
 * (`planDiscountCents = subtotalCents − basePriceCents`, `totalCents = basePriceCents − the code's discountCents`), a card
 * amount must come with its currency, and a way that cannot take the order must say why with a code. What mail multiplies
 * and rounds is not redone. A refusal's text is taken in the page language `lang` where mail sent it.
 */
export function parsePurchaseQuote(body: unknown, ask: QuoteAsk, lang?: Lang): PlanQuote {
  if (!record(body)) throw new ShopApiError("");
  const { planKind, quantity, minQuantity, maxQuantity, periodDays, prices } = body;
  if (
    body.productId !== ask.productId ||
    !isPlanKind(planKind) ||
    ![quantity, minQuantity, maxQuantity, periodDays].every(isCount) ||
    !Array.isArray(prices) ||
    ask.providers.length < 1 ||
    prices.length !== ask.providers.length
  )
    throw new ShopApiError("");
  const [count, min, max] = [quantity, minQuantity, maxQuantity] as number[];
  if (
    min! < 1 ||
    max! < min! ||
    max! > SEAT_MAX ||
    count! < min! ||
    count! > max! ||
    // A fixed plan is sold whole; a seat plan's quote is for the seats asked.
    (planKind === "fixed" ? max !== 1 : count !== ask.quantity) ||
    (planKind === "fixed") !== ask.quantity < 1
  )
    throw new ShopApiError("");
  const shared: QuoteShared = {
    productId: ask.productId,
    planKind,
    quantity: count!,
    minQuantity: min!,
    maxQuantity: max!,
    periodDays: periodDays as number,
  };
  return {
    ...shared,
    prices: prices.map((entry: unknown, index) => {
      const provider = ask.providers[index]!;
      // An entry for another way of paying than the one asked at its place is not an answer to the question.
      if (!record(entry) || !isProvider(entry.provider) || entry.provider !== provider || !isBoolean(entry.available))
        throw new ShopApiError("");
      if (entry.available) return { available: true as const, ...parseQuotePrice(entry, shared, provider, ask) };
      const refusal = parseRefusal(entry.refusal);
      if (!refusal.code || !record(entry.refusal)) throw new ShopApiError("");
      const text = (lang && refusal.messages[lang]) || entry.refusal.error;
      return {
        available: false as const,
        provider,
        code: refusal.code,
        message: isString(text) ? text : "",
        details: refusal.details,
      };
    }),
  };
}

/**
 * Asks mail what an order would cost (POST /api/shop/quote), for every way of paying of the ask in ONE request: mail
 * counts a request once against its limit however many ways it prices. It reserves nothing, and checkout prices the
 * order again by the same rules. Failures are ShopApiError: 404 from a mail before the endpoint, 429 with `retryAfter`
 * (60 quotes per 10 minutes per source IP), and mail's coded refusals of the whole request (`seat_quantity_invalid`,
 * `seat_quantity_out_of_range` with `min` and `max`, and `seat_total_too_large` with `maxTotalCents` or
 * `product_unavailable` when that is so for every way asked about).
 */
export async function quotePurchase(ask: QuoteAsk, signal?: AbortSignal, lang?: Lang): Promise<PlanQuote> {
  const body = await request(
    "quote",
    {
      productId: ask.productId,
      providers: [...ask.providers],
      ...(ask.quantity > 0 ? { quantity: ask.quantity } : {}),
      ...(ask.coupon ? { coupon: ask.coupon } : {}),
    },
    signal,
    lang,
  );
  return parsePurchaseQuote(body, ask, lang);
}

/**
 * What a page knows about one total it shows, for one way of paying (viewOf reads it off the board):
 * - `loading`: asked, not answered yet: the page keeps the fallback display.
 * - `quoted`: mail's numbers.
 * - `refused`: mail will not sell this (a coded refusal): the quantity is outside the plan's range, the total is above what
 *   one order can charge, or the plan is not on sale with this way of paying. `message` is mail's text in the page language.
 * - `limited`: the rate limit; the board asks again by itself at `retryAt` (milliseconds on the board's clock).
 * - `unavailable`: the request failed (network, an outage, an answer that does not parse). The page shows its estimate,
 *   and the next change of the ask tries again.
 * - `unsupported`: the backend has no quote endpoint (404). Nothing is asked again; the page behaves as it did before quotes.
 */
export type QuoteView =
  | { state: "loading" }
  | { state: "quoted"; quote: PurchaseQuote }
  | { state: "refused"; code: string; message: string; details: Readonly<Record<string, number>> }
  | { state: "limited"; retryAt: number }
  | { state: "unavailable" }
  | { state: "unsupported" };

/**
 * What the board knows about one ask (a plan and quantity, for every way of paying asked about): as QuoteView, except
 * that `quoted` is mail's whole answer, in which a way of paying is priced or refused by itself, and `refused` is a
 * refusal of the whole request (the quantity, or no way asked about can take the order).
 */
export type PlanQuoteView = Exclude<QuoteView, { state: "quoted" }> | { state: "quoted"; quote: PlanQuote };

/** How long a change of quantity waits before it is asked about, so that stepping from 2 to 12 is one request and not ten. */
export const QUOTE_DEBOUNCE_MS = 350;
/** How long to stay away after a rate limit that did not say (mail's 429 always carries Retry-After). */
export const QUOTE_RETRY_SECONDS = 60;
/** Answers kept per board: stepping back to a quantity already quoted asks nothing. */
const QUOTE_CACHE_SIZE = 200;

export interface QuoteBoardOptions {
  /** The request itself; quotePurchase unless a test says otherwise. */
  fetchQuote?: (ask: QuoteAsk, signal: AbortSignal, lang?: Lang) => Promise<PlanQuote>;
  lang?: Lang;
  debounceMs?: number;
  now?: () => number;
}

/** What a page reads off its board: every slot's view, and what mail's answers said about the plans beyond the totals. */
export interface QuoteSnapshot {
  views: Readonly<Record<string, PlanQuoteView>>;
  /** What each slot's view is about. */
  asks: Readonly<Record<string, QuoteAsk>>;
  /**
   * A plan's quantity range as mail last said it (in a quote, or in the refusal of a quantity outside it), by plan id. The
   * catalog the page loaded can be older, so the page reads the range here first.
   */
  ranges: Readonly<Record<string, { min: number; max: number }>>;
  /** The most one order can charge as mail last said it (`seat_total_too_large`); null until it did. */
  maxTotalCents: number | null;
}

const EMPTY_SNAPSHOT: QuoteSnapshot = { views: {}, asks: {}, ranges: {}, maxTotalCents: null };

interface Slot {
  ask: QuoteAsk;
  view: PlanQuoteView;
  timer: ReturnType<typeof setTimeout> | null;
  request: AbortController | null;
}

function askKey(ask: QuoteAsk): string {
  return `${ask.productId}:${ask.providers.join("+")}:${ask.quantity}:${ask.coupon ?? ""}`;
}

/**
 * The quotes of one page. A slot is one plan's figures on the page (its total for every way of paying on offer); `want`
 * says what they should be about now, and `view` what is known about them. A slot is one request per settled change,
 * whatever the number of ways of paying: mail prices them in one answer.
 *
 * - The first ask of a slot goes out at once; a change of an existing slot waits QUOTE_DEBOUNCE_MS, and a further change
 *   within that time replaces it, so only the quantity the buyer settled on is asked about.
 * - A request in flight for a slot is cancelled when the slot's ask changes: a late answer for another quantity is never
 *   shown, and never overwrites a newer one.
 * - Answers (quotes and coded refusals) are remembered per ask, so going back to a quantity asks nothing.
 * - A 429 stops every request until Retry-After has passed, then the open slots are asked again, once.
 * - A 404 means the backend has no quote endpoint: every slot becomes `unsupported` and nothing is asked again.
 * - Any other failure leaves the slot `unavailable` (the page shows its estimate) and is not remembered.
 *
 * A slot the page stops showing is dropped (`drop`), and `clear` drops them all.
 * It holds no DOM or React state: `subscribe` and `snapshot` are what useSyncExternalStore takes.
 */
export class QuoteBoard {
  private readonly slots = new Map<string, Slot>();
  private readonly answers = new Map<string, PlanQuoteView>();
  private readonly listeners = new Set<() => void>();
  private readonly fetchQuote: NonNullable<QuoteBoardOptions["fetchQuote"]>;
  private readonly lang: Lang | undefined;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private current: QuoteSnapshot = EMPTY_SNAPSHOT;
  private ranges: Record<string, { min: number; max: number }> = {};
  private maxTotalCents: number | null = null;
  private unsupported = false;
  private pausedUntil = 0;
  private resume: ReturnType<typeof setTimeout> | null = null;

  constructor(options: QuoteBoardOptions = {}) {
    this.fetchQuote = options.fetchQuote ?? quotePurchase;
    this.lang = options.lang;
    this.debounceMs = options.debounceMs ?? QUOTE_DEBOUNCE_MS;
    this.now = options.now ?? Date.now;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Every slot's view and what was learned about the plans, as one object that is replaced (never changed) when any of it changes. */
  readonly snapshot = (): QuoteSnapshot => this.current;

  /** Whether the backend answered that it has no quote endpoint. */
  get supported(): boolean {
    return !this.unsupported;
  }

  /** Says what a slot should be about. The same ask again changes nothing and asks nothing. */
  want(slot: string, ask: QuoteAsk): void {
    const current = this.slots.get(slot);
    if (current && askKey(current.ask) === askKey(ask)) return;
    this.cancel(current);
    const next: Slot = { ask, view: { state: "loading" }, timer: null, request: null };
    this.slots.set(slot, next);
    if (this.unsupported) return this.show(next, { state: "unsupported" });
    const known = this.answers.get(askKey(ask));
    if (known) return this.show(next, known);
    if (this.now() < this.pausedUntil) return this.show(next, { state: "limited", retryAt: this.pausedUntil });
    this.show(next, { state: "loading" });
    // The first figure of a slot is asked for at once; a change waits for the buyer to stop changing it.
    if (current) next.timer = setTimeout(() => this.send(slot, next), this.debounceMs);
    else this.send(slot, next);
  }

  /** The page no longer shows this figure: its request is cancelled and its view goes away. */
  drop(slot: string): void {
    const current = this.slots.get(slot);
    if (!current) return;
    this.cancel(current);
    this.slots.delete(slot);
    this.publish();
  }

  /**
   * Cancels every request and timer and forgets the slots: the page is gone, or is being set up again. The board stays
   * usable (React runs an effect's cleanup and the effect again in development), and what was answered stays remembered.
   */
  clear(): void {
    for (const slot of this.slots.values()) this.cancel(slot);
    if (this.resume) clearTimeout(this.resume);
    this.resume = null;
    this.slots.clear();
    this.publish();
  }

  private cancel(slot: Slot | undefined): void {
    if (!slot) return;
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    slot.request?.abort();
    slot.request = null;
  }

  private show(slot: Slot, view: PlanQuoteView): void {
    slot.view = view;
    this.publish();
  }

  private publish(): void {
    this.current = {
      views: Object.fromEntries([...this.slots].map(([name, slot]) => [name, slot.view])),
      asks: Object.fromEntries([...this.slots].map(([name, slot]) => [name, slot.ask])),
      ranges: this.ranges,
      maxTotalCents: this.maxTotalCents,
    };
    for (const listener of [...this.listeners]) listener();
  }

  /** Keeps what an answer said about a plan's range or the most one order can charge. */
  private note(productId: string | undefined, view: PlanQuoteView | undefined, error?: unknown): void {
    const refusal = seatRefusal(error);
    const range = quotedRange(view) ?? (refusal?.code === "seat_quantity_out_of_range" ? refusal : null);
    if (productId && range) {
      const known = this.ranges[productId];
      if (!known || known.min !== range.min || known.max !== range.max)
        this.ranges = { ...this.ranges, [productId]: { min: range.min, max: range.max } };
    }
    // The cap is one number for every way of paying (in the unit that way charges in), wherever mail says it: a refusal
    // elsewhere, the refusal of this request, or the entry of a way of paying that alone cannot take the order.
    const cap =
      refusal?.code === "seat_total_too_large"
        ? refusal.maxTotalCents
        : view?.state === "refused" && view.code === "seat_total_too_large"
          ? view.details.maxTotalCents
          : view?.state === "quoted"
            ? view.quote.prices.flatMap((price) =>
                !price.available && price.code === "seat_total_too_large" ? [price.details.maxTotalCents] : [],
              )[0]
            : undefined;
    if (isCount(cap) && cap >= 1) this.maxTotalCents = cap;
  }

  /**
   * A refusal mail gave elsewhere (the discount code preview, checkout) says the page's picture is out of date: a plan's
   * range changed, or the most one order can charge is not what the page assumed. What the refusal says is kept
   * (`productId` names the plan a range refusal is about, when the caller knows it), the remembered answers are dropped
   * and every figure is asked about again.
   */
  learn(error: unknown, productId?: string): void {
    if (!seatRefusal(error)) return;
    this.note(productId, undefined, error);
    this.answers.clear();
    for (const [name, slot] of this.slots) {
      this.cancel(slot);
      slot.view = { state: "loading" };
      this.send(name, slot);
    }
    this.publish();
  }

  private remember(ask: QuoteAsk, view: PlanQuoteView): void {
    if (this.answers.size >= QUOTE_CACHE_SIZE) this.answers.delete(this.answers.keys().next().value!);
    this.answers.set(askKey(ask), view);
  }

  private send(name: string, slot: Slot): void {
    slot.timer = null;
    if (this.slots.get(name) !== slot) return;
    if (this.unsupported) return this.show(slot, { state: "unsupported" });
    if (this.now() < this.pausedUntil) return this.show(slot, { state: "limited", retryAt: this.pausedUntil });
    const controller = new AbortController();
    slot.request = controller;
    const current = () => !controller.signal.aborted && this.slots.get(name) === slot;
    this.fetchQuote(slot.ask, controller.signal, this.lang).then(
      (quote) => {
        if (!current()) return;
        slot.request = null;
        const view: PlanQuoteView = { state: "quoted", quote };
        this.remember(slot.ask, view);
        this.note(slot.ask.productId, view);
        this.show(slot, view);
      },
      (error: unknown) => {
        if (!current()) return;
        slot.request = null;
        if (error instanceof ShopApiError && error.status === 404 && !error.code) return this.noEndpoint();
        if (error instanceof ShopApiError && error.status === 429) return this.pause(error.retryAfter);
        if (error instanceof ShopApiError && error.code) {
          const view: PlanQuoteView = {
            state: "refused",
            code: error.code,
            message: (this.lang && error.messages[this.lang]) || error.message,
            details: error.details,
          };
          this.remember(slot.ask, view);
          this.note(slot.ask.productId, view);
          return this.show(slot, view);
        }
        this.show(slot, { state: "unavailable" });
      },
    );
  }

  /** The backend has no quote endpoint: every figure falls back for good, and what is in flight is cancelled. */
  private noEndpoint(): void {
    this.unsupported = true;
    for (const slot of this.slots.values()) {
      this.cancel(slot);
      slot.view = { state: "unsupported" };
    }
    this.publish();
  }

  /** The rate limit: nothing is asked until it has passed, then every figure still waiting is asked about once. */
  private pause(retryAfter: number | null): void {
    this.pausedUntil = this.now() + (retryAfter ?? QUOTE_RETRY_SECONDS) * 1000;
    for (const slot of this.slots.values()) {
      if (slot.view.state !== "loading") continue;
      this.cancel(slot);
      slot.view = { state: "limited", retryAt: this.pausedUntil };
    }
    this.publish();
    if (this.resume) clearTimeout(this.resume);
    this.resume = setTimeout(
      () => {
        this.resume = null;
        for (const [name, slot] of this.slots) {
          if (slot.view.state !== "limited") continue;
          slot.view = { state: "loading" };
          this.send(name, slot);
        }
        this.publish();
      },
      Math.max(0, this.pausedUntil - this.now()),
    );
  }
}

/**
 * One total a seat plan's card shows, for one way of paying:
 * - `quoted`: mail's numbers for the quantity. Nothing on the page is worked out.
 * - `estimate`: no quote (a mail before the endpoint, one on its way, the rate limit, a failed request): the total the page
 *   works out by mail's rule, shown as an estimate that checkout confirms.
 * - `tooMany`: that many seats cost more than one order can charge with this way of paying; the other way may still take them.
 * - `refused`: mail will not sell this for another reason (the plan left the shop, the range changed), in its own words.
 */
export type SeatFigure =
  | {
      kind: "quoted";
      /** The currency the total is counted in, as the quote says it; "" for LDC. */
      currency: string;
      totalCents: number;
      /** The order before the plan's discount; equal to the total when there is none. */
      subtotalCents: number;
      discountPercent: number;
      /** Each later period for this quantity; 0 for a one-time purchase. */
      renewPriceCents: number;
      periodDays: number;
      /** What a discount code is applied to. */
      basePriceCents: number;
    }
  | { kind: "estimate"; totalCents: number; subtotalCents: number }
  | { kind: "tooMany" }
  | { kind: "refused"; message: string };

/**
 * What to show for a slot of the board, given the page's own estimate for the same quantity (null when the estimate is
 * above what one order can charge). A quote and a coded refusal are mail's answer and win; everything else falls back.
 */
export function seatFigure(
  view: QuoteView | undefined,
  estimate: { originalPriceCents: number; priceCents: number } | null,
): SeatFigure {
  if (view?.state === "quoted") {
    const { currency, totalCents, subtotalCents, discountPercent, renewPriceCents, periodDays, basePriceCents } =
      view.quote;
    return {
      kind: "quoted",
      currency,
      totalCents,
      subtotalCents,
      discountPercent,
      renewPriceCents,
      periodDays,
      basePriceCents,
    };
  }
  if (view?.state === "refused") {
    return view.code === "seat_total_too_large" ? { kind: "tooMany" } : { kind: "refused", message: view.message };
  }
  return estimate
    ? { kind: "estimate", totalCents: estimate.priceCents, subtotalCents: estimate.originalPriceCents }
    : { kind: "tooMany" };
}

/** What a total is labelled with: the currency it is counted in ("" for LDC), the billing period and the plan's discount. */
export interface SeatTerms {
  currency: string;
  periodDays: number;
  discountPercent: number;
}

/**
 * The terms a seat plan's total is labelled with. A quoted total is mail's answer of this moment, and the catalog the page
 * loaded can be older than it (a plan's period, discount or card currency changed since): the quote's own terms label it,
 * so the amount, its currency, its period, the discount note and the renewal line all say the same thing. Only an estimate,
 * which the page works out from the catalog, is labelled with the catalog's terms.
 */
export function seatTerms(figure: Extract<SeatFigure, { kind: "quoted" | "estimate" }>, catalog: SeatTerms): SeatTerms {
  return figure.kind === "quoted"
    ? { currency: figure.currency, periodDays: figure.periodDays, discountPercent: figure.discountPercent }
    : catalog;
}

/** A range mail would accept for a quantity field: whole numbers, 1 to SEAT_MAX, min not above max. */
function usableRange(min: unknown, max: unknown): { min: number; max: number } | null {
  return isCount(min) && isCount(max) && min >= 1 && max >= min && max <= SEAT_MAX ? { min, max } : null;
}

/**
 * The plan's quantity range as mail says it right now, when a view says it: a quote carries it (`minQuantity`,
 * `maxQuantity`), and so does the refusal of a quantity outside it (`min`, `max`). The catalog the page loaded can be older
 * than either, so the page takes this over the catalog's range. null when the view says nothing about it.
 */
export function quotedRange(view: QuoteView | PlanQuoteView | undefined): { min: number; max: number } | null {
  if (view?.state === "quoted") return usableRange(view.quote.minQuantity, view.quote.maxQuantity);
  if (view?.state === "refused" && view.code === "seat_quantity_out_of_range")
    return usableRange(view.details.min, view.details.max);
  return null;
}

/**
 * What a failed request says about seat quantities, for the callers that are not the board (the discount code preview,
 * checkout): the plan's range from `seat_quantity_out_of_range`, or the most one order can charge from
 * `seat_total_too_large`. null for any other failure.
 */
export function seatRefusal(
  error: unknown,
):
  | { code: "seat_quantity_out_of_range"; min: number; max: number }
  | { code: "seat_total_too_large"; maxTotalCents: number }
  | null {
  if (!(error instanceof ShopApiError)) return null;
  if (error.code === "seat_quantity_out_of_range") {
    const range = usableRange(error.details.min, error.details.max);
    return range && { code: error.code, ...range };
  }
  if (error.code === "seat_total_too_large") {
    const { maxTotalCents } = error.details;
    return isCount(maxTotalCents) && maxTotalCents >= 1 ? { code: error.code, maxTotalCents } : null;
  }
  return null;
}

/**
 * What a slot knows about one way of paying, when the slot is about the plan and quantity the page shows right now. A
 * page says what it wants after it has drawn, so for one drawing the slot can still hold the answer for the quantity
 * before: that answer is not shown as the new quantity's (undefined, and the page shows its estimate until the board has
 * caught up). The same goes for a way of paying the slot's ask does not name. In mail's answer each way is priced or
 * refused by itself, and a refusal of the whole request is every way's.
 */
export function viewOf(
  snapshot: QuoteSnapshot,
  slot: string,
  productId: string,
  quantity: number,
  provider: ShopPaymentProvider,
): QuoteView | undefined {
  const ask = snapshot.asks[slot];
  const view = snapshot.views[slot];
  if (!ask || !view || ask.productId !== productId || ask.quantity !== quantity || !ask.providers.includes(provider))
    return undefined;
  if (view.state !== "quoted") return view;
  const price = view.quote.prices.find((entry) => entry.provider === provider);
  if (!price) return undefined;
  if (!price.available) return { state: "refused", code: price.code, message: price.message, details: price.details };
  return { state: "quoted", quote: price };
}

/**
 * What one period of a trial's upgrade to a seat plan costs, for the renewal page: the first period in LDC (the plan's
 * discount applies to it), each later LDC period, and a period by card. mail's quote prices a new order of the same plan
 * and quantity by the terms `renew` uses for the upgrade's first period (mail's docs/shop.md, "Upgrading a trial directly
 * to Team"), so its numbers are shown when it is there; without one the page works them out as it did before quotes.
 * The quote knows nothing of further periods or of the trial's own conditions: `renew` has the final say.
 */
export function upgradePeriodPrices(
  plan: { originalPriceCents: number; discountPercent: number; renewPriceCents: number; fiatPriceMinor: number },
  quantity: number,
  ldc: QuoteView | undefined,
  card: QuoteView | undefined,
): { firstLdcCents: number; renewLdcCents: number; cardCents: number } {
  const ldcQuote = ldc?.state === "quoted" ? ldc.quote : null;
  const cardQuote = card?.state === "quoted" ? card.quote : null;
  return {
    firstLdcCents: ldcQuote ? ldcQuote.basePriceCents : (seatOrderPrice(plan, quantity)?.priceCents ?? 0),
    renewLdcCents: ldcQuote ? ldcQuote.renewPriceCents : plan.renewPriceCents * quantity,
    cardCents: cardQuote ? cardQuote.basePriceCents : plan.fiatPriceMinor * quantity,
  };
}
