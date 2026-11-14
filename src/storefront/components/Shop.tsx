"use client";

import Link from "next/link";
import { trialCopy } from "@/storefront/lib/trial";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANG_PATHS, storePath, type Lang } from "@/storefront/i18n";
import {
  catalogPlans,
  clampSeats,
  createShopOrder,
  formatCredits,
  getShopCatalog,
  isSeatProduct,
  previewCouponPlans,
  seatTotals,
  ShopApiError,
  type CouponQuote,
  type ShopCatalog,
  formatMoney,
  formatUsdt,
  type ShopPaymentProvider,
} from "@/storefront/lib/shop";
import { COUPON_MAX_LENGTH, couponVerdict, normalizeCoupon, rememberCoupon } from "@/storefront/lib/coupon";
import { QuoteBoard, seatFigure, seatRefusal, seatTerms, viewOf, type SeatFigure } from "@/storefront/lib/quote";
import { takeEarlyCatalog } from "@/storefront/lib/catalog";
import { describeShopError } from "@/storefront/lib/shop-error";
import { useShopCopy } from "./copy/context";
import {
  ADDRESS_PARAM,
  PLAN_PARAM,
  forgetAddress,
  parseAddress,
  parsePlan,
  rememberAddress,
  storedAddress,
  subscribeAddress,
  withoutAddress,
} from "@/storefront/lib/address";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { ShopDetails } from "./ShopDetails";
import {
  ShopAlert,
  ShopButton,
  ShopField,
  ShopHero,
  ShopSkeleton,
  ShopTestnetBadge,
  ShopTextLink,
  shopArriveClass,
  shopEmptyClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopNoteClass,
  shopPageClass,
  shopTextClass,
} from "./ShopParts";
import { ShopPrice } from "./ShopPrice";
import { ShopSeatStepper } from "./ShopSeatStepper";
import { ShopSession } from "./ShopSession";

/** The page is prerendered without a query string; it is read once the page runs in the browser. */
function readSearch(): string {
  return window.location.search;
}

function subscribeToHistory(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/**
 * "Don't use this address": out of the tab's storage and out of the page's address too, or a reload or the language toggle
 * (which carries ?address=, src/i18n/paths.ts) would keep it again.
 */
function dismissAddress(): void {
  const { pathname, search, hash } = window.location;
  if (new URLSearchParams(search).has(ADDRESS_PARAM)) {
    window.history.replaceState(null, "", `${pathname}${withoutAddress(search)}${hash}`);
  }
  forgetAddress();
}

/**
 * The preview of the applied code per plan, way of paying and quantity ("<plan id>:<provider>:<seats>", 0 seats for a fixed plan):
 * a quote, or null when it cannot be used. A key that is absent was not asked about: a seat plan whose quantity changed after
 * "Apply" shows "checked when you order" until the code is applied again, since mail quotes a code for one quantity.
 */
type CouponQuotes = Record<string, CouponQuote | null>;

/** Whether a seat plan's total for one way of paying is something mail would sell: its quote, or the page's estimate while there is none. */
function sold(figure: SeatFigure | null): figure is Extract<SeatFigure, { kind: "quoted" | "estimate" }> {
  return figure?.kind === "quoted" || figure?.kind === "estimate";
}

export function Shop({ lang }: { lang: Lang }) {
  const t = useShopCopy();
  const router = useRouter();
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const checkoutLock = useRef(false);
  // Discount code: what is in the field is sent with checkout, whether or not it was previewed, so a typed code is never
  // dropped silently; mail then prices the order with it or refuses the checkout. "Apply" previews it per plan first.
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; quotes: CouponQuotes; offered: number } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState("");
  // The backend has no discount codes (the preview answered 404): the field goes away.
  const [couponsMissing, setCouponsMissing] = useState(false);
  const couponRequest = useRef<AbortController | null>(null);
  // A mail before the several-plans preview refused it once: later presses ask plan by plan at once, sparing a guess.
  const couponLegacy = useRef(false);
  // ?plan=<id> points out the plan a pricing card linked to; ?address=name@domain is the address picked in the address check.
  // The address is kept for this tab (src/storefront/lib/address.ts) so the forms that create the mailbox start with it.
  const search = useSyncExternalStore(subscribeToHistory, readSearch, () => "");
  const selectedPlan = parsePlan(new URLSearchParams(search).get(PLAN_PARAM));
  const linkedAddress = new URLSearchParams(search).get(ADDRESS_PARAM);
  const carried = parseAddress(useSyncExternalStore(subscribeAddress, storedAddress, () => ""));
  const selectedCard = useRef<HTMLElement>(null);
  const checkoutAlert = useRef<HTMLDivElement>(null);
  // Fixed plans, then the plans sold per mailbox (the catalog's `seatProducts`; none on a backend without them).
  const plans = catalog ? catalogPlans(catalog) : [];
  const hasSelected = Boolean(selectedPlan && plans.some((product) => product.id === selectedPlan));
  // How many mailboxes of each seat plan: the plan's minimum until the buyer changes it.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // What each seat plan costs for its quantity is mail's to say (POST /api/shop/quote, src/storefront/lib/quote.ts): the
  // board asks when a quantity changes (after a pause, cancelling what was asked before) and remembers the answers.
  // Without a quote (a mail before the endpoint, one on its way, the rate limit, a failed request) the card shows the
  // page's own estimate, as it did before quotes.
  const [board] = useState(() => new QuoteBoard({ lang }));
  const quotes = useSyncExternalStore(board.subscribe, board.snapshot, board.snapshot);
  useEffect(() => () => board.clear(), [board]);
  /** The range of a seat plan's quantity: as mail last said it in a quote or a refusal, else as the catalog has it. */
  const rangeOf = (product: (typeof plans)[number]) => {
    if (!isSeatProduct(product)) return null;
    const known = quotes.ranges[product.id];
    return known
      ? { minQuantity: known.min, maxQuantity: known.max }
      : { minQuantity: product.minQuantity, maxQuantity: product.maxQuantity };
  };
  const seatsOf = (product: (typeof plans)[number]) => {
    const range = rangeOf(product);
    return range ? clampSeats(quantities[product.id] ?? range.minQuantity, range) : 0;
  };

  /**
   * What a plan costs and which ways of paying it can be bought with right now: offered by the shop and, for a seat plan,
   * able to take the quantity. A seat plan's totals are mail's quotes; the estimate stands in while there is none.
   */
  const waysOf = (product: (typeof plans)[number]) => {
    const ldc = Boolean(catalog?.payment.ldc);
    const card = Boolean(catalog?.payment.stripe && product.fiatPriceMinor);
    // USDT, like a card, only for a plan with a USDT price of its own.
    const usdt = Boolean(catalog?.payment.usdt && product.usdtPriceMinor);
    if (!isSeatProduct(product))
      return { ldc, card, usdt, ldcFigure: null, cardFigure: null, usdtFigure: null, asking: false };
    const seats = seatsOf(product);
    const estimate = seatTotals(product, seats, { ldc, card, usdt }, quotes.maxTotalCents ?? undefined);
    const ldcView = viewOf(quotes, product.id, product.id, seats, "ldc");
    const cardView = viewOf(quotes, product.id, product.id, seats, "stripe");
    const usdtView = viewOf(quotes, product.id, product.id, seats, "usdt");
    const ldcFigure = ldc ? seatFigure(ldcView, estimate.ldc) : null;
    const cardFigure = card
      ? seatFigure(
          cardView,
          estimate.card === null ? null : { originalPriceCents: estimate.card, priceCents: estimate.card },
        )
      : null;
    const usdtFigure = usdt
      ? seatFigure(
          usdtView,
          estimate.usdt === null ? null : { originalPriceCents: estimate.usdt, priceCents: estimate.usdt },
        )
      : null;
    return {
      ldc: sold(ldcFigure),
      card: sold(cardFigure),
      usdt: sold(usdtFigure),
      ldcFigure,
      cardFigure,
      usdtFigure,
      asking:
        (ldc && ldcView?.state === "loading") ||
        (card && cardView?.state === "loading") ||
        (usdt && usdtView?.state === "loading"),
    };
  };

  // One quote per seat plan, for the quantity on the card and every way of paying on offer: mail prices them in one
  // answer, so a change of quantity is one request per plan. No discount code goes with it: a quote with a code is a guess
  // against mail's limit on code guesses, and these are asked without the buyer pressing anything.
  const seatAsks = !catalog
    ? []
    : plans.filter(isSeatProduct).flatMap((product) => {
        const providers = [
          ...(catalog.payment.ldc ? ["ldc"] : []),
          ...(catalog.payment.stripe && product.fiatPriceMinor ? ["stripe"] : []),
          ...(catalog.payment.usdt && product.usdtPriceMinor ? ["usdt"] : []),
        ];
        return providers.length > 0 ? [`${product.id}:${providers.join("+")}:${seatsOf(product)}`] : [];
      });
  const seatAskKey = seatAsks.join(" ");
  useEffect(() => {
    for (const entry of seatAskKey ? seatAskKey.split(" ") : []) {
      const [productId, providers, quantity] = entry.split(":") as [string, string, string];
      board.want(productId, {
        productId,
        providers: providers.split("+") as ShopPaymentProvider[],
        quantity: Number(quantity),
      });
    }
  }, [board, seatAskKey]);

  useEffect(() => {
    const address = parseAddress(linkedAddress);
    if (address) rememberAddress(address);
  }, [linkedAddress]);

  useEffect(() => {
    if (hasSelected) selectedCard.current?.scrollIntoView({ block: "nearest" });
  }, [hasSelected]);

  // The refusal is shown above the plans, and the button that was pressed can be a screen further down.
  useEffect(() => {
    if (checkoutError) checkoutAlert.current?.scrollIntoView({ block: "center" });
  }, [checkoutError]);

  useEffect(() => {
    const controller = new AbortController();
    // The page's inline script (ShopCatalogPrefetch) asked for the catalog while the HTML was parsed; only a retry asks again.
    (takeEarlyCatalog(lang, controller.signal) ?? getShopCatalog(controller.signal, lang))
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(describeShopError(error, lang, t));
      });
    return () => controller.abort();
  }, [attempt, lang, t]);

  // mail's catalog says whether to offer discount codes: `coupons: false` hides the field without a request. A mail before the
  // flag sends none: the field is then offered, and goes away when the preview answers 404.
  const couponsOffered = catalog?.coupons !== false && !couponsMissing;
  const typedCoupon = couponsOffered ? normalizeCoupon(coupon) : "";

  useEffect(() => () => couponRequest.current?.abort(), []);

  function changeCoupon(value: string) {
    couponRequest.current?.abort();
    setCoupon(value);
    // The prices shown were for the code that was applied, not for what is being typed now.
    setApplied(null);
    setCouponChecking(false);
    setCouponError("");
  }

  async function applyCoupon() {
    if (!catalog || !typedCoupon) return;
    couponRequest.current?.abort();
    const controller = new AbortController();
    couponRequest.current = controller;
    setCouponChecking(true);
    setCouponError("");
    setApplied(null);
    // The plan the visitor arrived for first, then catalog order; each plan once per way of paying it offers.
    const products = [...plans].sort((a, b) => Number(b.id === selectedPlan) - Number(a.id === selectedPlan));
    // A way of paying that cannot take a seat plan's quantity is not on offer and is not asked about: mail refuses the
    // whole request for such a total (400 `seat_total_too_large`), and no plan would get its price.
    const offered = products.flatMap((product) => {
      const open = waysOf(product);
      // The quantity as it is now: the answer is for it, whatever the stepper says by the time it arrives.
      const seats = seatsOf(product);
      return [
        ...(open.ldc ? [{ product, provider: "ldc" as const, seats }] : []),
        ...(open.card ? [{ product, provider: "stripe" as const, seats }] : []),
        ...(open.usdt ? [{ product, provider: "usdt" as const, seats }] : []),
      ];
    });
    // One request (one guess against mail's limit) for up to eight of them, further requests only for a larger catalog; what
    // is past the limit of a press shows "checked when you order", and checkout has the final say for every plan anyway.
    const result = await previewCouponPlans(
      offered.map(({ product, provider, seats }) => ({ productId: product.id, provider, quantity: seats })),
      typedCoupon,
      { signal: controller.signal, lang, legacy: couponLegacy.current },
    );
    if (controller.signal.aborted) return;
    couponLegacy.current = result.legacy;
    const quotes: CouponQuotes = {};
    let code = typedCoupon.toUpperCase();
    result.quotes.forEach((quote, index) => {
      if (quote === undefined) return;
      const { product, provider, seats } = offered[index]!;
      quotes[`${product.id}:${provider}:${seats}`] = quote;
      if (quote) code = quote.code;
    });
    if (result.error !== undefined) {
      if (result.error instanceof ShopApiError && result.error.status === 404) {
        setCouponsMissing(true);
        setCoupon("");
        setCouponChecking(false);
        return;
      }
      // A seat quantity mail does not sell fails the whole preview with a code and its numbers: the plan's range, or the
      // most one order can charge. That is not "this code can't be used", and it means the page's picture of the plans is
      // out of date: the board takes the numbers and asks for its totals again, and the buyer applies the code once more.
      const refusal = seatRefusal(result.error);
      if (refusal) {
        // mail says which entry it refused (`index`), so the range goes to that plan however many seat plans the page
        // has. A mail before `index` does not say: with one seat plan on the page there is no doubt, with several the
        // range is not pinned on any (every total is asked again all the same).
        const about = result.errorAt === undefined ? undefined : offered[result.errorAt];
        const seatPlans = [...new Set(offered.filter(({ seats }) => seats > 0).map(({ product }) => product.id))];
        board.learn(result.error, about ? about.product.id : seatPlans.length === 1 ? seatPlans[0] : undefined);
        // The most one order can charge is one number, counted in the unit of the way of paying refused.
        const cardCurrency = about?.provider === "stripe" ? catalog?.payment.stripe?.currency : undefined;
        setCouponError(
          refusal.code === "seat_quantity_out_of_range"
            ? t.couponSeatRange(refusal.min, refusal.max)
            : t.couponSeatTotal(
                about?.provider === "usdt"
                  ? formatUsdt(refusal.maxTotalCents)
                  : cardCurrency
                    ? formatMoney(refusal.maxTotalCents, cardCurrency, lang)
                    : formatCredits(refusal.maxTotalCents),
              ),
        );
      } else setCouponError(describeShopError(result.error, lang, t));
    }
    // What was answered before a failure still stands: the plans it covers show their price.
    if (Object.keys(quotes).length > 0) setApplied({ code, quotes, offered: offered.length });
    setCouponChecking(false);
  }

  async function checkout(productId: string, provider: ShopPaymentProvider = "ldc") {
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setBuying(`${productId}:${provider}`);
    setCheckoutError("");
    try {
      const product = plans.find((item) => item.id === productId);
      const seats = product ? seatsOf(product) : 0;
      const id = await createShopOrder(productId, lang, email.trim(), provider, typedCoupon, seats);
      if (typedCoupon) {
        // mail took the code (it refuses the checkout otherwise). It publishes the code and what it took off with the order,
        // and the order page uses that; the price before the code is still remembered for this tab, only as the fallback for
        // a mail before those fields (src/storefront/lib/coupon.ts).
        const ways = product && waysOf(product);
        const figure =
          ways && (provider === "stripe" ? ways.cardFigure : provider === "usdt" ? ways.usdtFigure : ways.ldcFigure);
        const baseCents = !product
          ? undefined
          : figure
            ? figure.kind === "quoted"
              ? figure.basePriceCents
              : figure.kind === "estimate"
                ? figure.totalCents
                : undefined
            : provider === "stripe"
              ? product.fiatPriceMinor
              : provider === "usdt"
                ? product.usdtPriceMinor
                : product.priceCents;
        if (baseCents) rememberCoupon({ orderId: id, code: applied?.code ?? typedCoupon.toUpperCase(), baseCents });
      }
      router.push(`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(id)}`);
    } catch (error) {
      // mail's refusal in the page language. One about the quantity (the plan's range changed, the total is too large)
      // also corrects the card: the board takes its numbers and asks for the totals again.
      board.learn(error, productId);
      setCheckoutError(describeShopError(error, lang, t));
      setBuying(null);
      checkoutLock.current = false;
    }
  }

  return (
    <div className={shopPageClass}>
      <div className={shopHeadingRowClass}>
        <ShopTextLink href={storePath(lang)}>← {t.back}</ShopTextLink>
        <span className="flex flex-wrap gap-4">
          <ShopTextLink href={`/${LANG_PATHS[lang]}shop/orders/`}>{t.orderLink} ↗</ShopTextLink>
          <ShopTextLink href={`/${LANG_PATHS[lang]}shop/account/`}>{t.accountNav} ↗</ShopTextLink>
        </span>
      </div>
      <ShopSession lang={lang} />
      <ShopHero eyebrow={t.eyebrow} title={t.title}>
        {t.description}
      </ShopHero>
      {catalog?.trial && (
        // A banner above the plans: the offer on the left, its one action on the right; stacked on a phone.
        <Card className="mb-12 flex-row flex-wrap items-center justify-between gap-x-8 gap-y-5 p-7 max-narrow:mb-10 max-narrow:px-5 max-narrow:py-[22px]">
          <div className="max-w-[640px] min-w-0 flex-[1_1_320px]">
            <h2 className={shopHeadingClass}>{trialCopy[lang].title}</h2>
            <p className={shopTextClass}>{trialCopy[lang].description(catalog.trial.days, catalog.trial.quotaMb)}</p>
          </div>
          <ShopButton asChild className="shrink-0 max-narrow:w-full">
            <Link href={`/${LANG_PATHS[lang]}shop/account/`}>{trialCopy[lang].signin}</Link>
          </ShopButton>
        </Card>
      )}

      {loadError ? (
        <Card asChild className={shopEmptyClass}>
          <div>
            <p className={shopTextClass} role="alert">
              {loadError}
            </p>
            <ShopButton
              variant="outline"
              className="mt-[18px]"
              onClick={() => {
                setLoadError("");
                setAttempt((value) => value + 1);
              }}
            >
              {t.retry}
            </ShopButton>
          </div>
        </Card>
      ) : !catalog ? (
        // The shape of the plans to come, so the page does not jump when they arrive.
        <div
          className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-5"
          role="status"
          aria-busy="true"
        >
          <span className="sr-only">{t.loading}</span>
          {[0, 1, 2].map((index) => (
            <Card className="block p-7 max-narrow:px-5 max-narrow:py-[22px]" key={index}>
              <ShopSkeleton className="mb-[22px] size-[38px]" />
              <ShopSkeleton className="h-6 w-3/5" />
              <ShopSkeleton className="mt-4 h-4 w-full" />
              <ShopSkeleton className="mt-2 h-4 w-4/5" />
              <ShopSkeleton className="mt-[30px] h-11 w-2/5" />
              <ShopSkeleton className="mt-[30px] h-4 w-full" />
              <ShopSkeleton className="mt-2 h-4 w-2/3" />
              <ShopSkeleton className="mt-8 h-10 w-36" />
            </Card>
          ))}
        </div>
      ) : !catalog.available || plans.length === 0 ? (
        <Card className={shopEmptyClass}>
          <h2 className="text-xl">{t.closed}</h2>
          <p className={shopTextClass}>{t.closedDescription}</p>
        </Card>
      ) : (
        <section className={shopArriveClass} aria-labelledby="shop-products-title">
          <div>
            <h2 className={shopHeadingClass} id="shop-products-title">
              {t.choose}
            </h2>
            <p className={shopTextClass}>{t.pricing}</p>
          </div>
          {carried && (
            <Alert className="mt-5 max-w-[640px]">
              <AlertDescription className="text-foreground">
                {t.carriedAddress(`${carried.username}@${carried.domain}`)}
              </AlertDescription>
              <div>
                <Button variant="link" className="text-sm" type="button" onClick={dismissAddress}>
                  {t.carriedRemove}
                </Button>
              </div>
            </Alert>
          )}
          {/* The order's options, side by side above the tablet width: the contact email, then the discount code. */}
          <div className="flex flex-wrap items-start gap-x-12 max-tablet:block">
            {plans.some((product) => product.periodDays) && (
              <div className="max-w-[420px] min-w-0 flex-[1_1_320px]">
                <ShopField
                  htmlFor="shop-contact-email"
                  label={t.emailLabel}
                  hint={t.emailHint}
                  hintId="shop-contact-email-hint"
                >
                  <Input
                    className={cn(shopInputClass, "max-w-[420px]")}
                    id="shop-contact-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby="shop-contact-email-hint"
                  />
                </ShopField>
              </div>
            )}
            {couponsOffered && (
              <details className="group/coupon mt-5 mb-6 max-w-[520px] max-tablet:mt-0 min-w-0 flex-[1_1_320px]">
                <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 text-sm/body text-foreground underline decoration-border underline-offset-4 hover:decoration-current [&::-webkit-details-marker]:hidden">
                  {t.couponToggle}
                  <span
                    className="text-muted-foreground no-underline transition-transform duration-150 group-open/coupon:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <form
                  className="mt-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void applyCoupon();
                  }}
                >
                  <ShopField
                    htmlFor="shop-coupon"
                    label={t.couponLabel}
                    hint={couponError || t.couponHint}
                    hintId="shop-coupon-hint"
                    invalid={Boolean(couponError)}
                  >
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className={cn(shopInputClass, "max-w-[260px] min-w-0 flex-1 uppercase placeholder:normal-case")}
                        id="shop-coupon"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={COUPON_MAX_LENGTH}
                        value={coupon}
                        onChange={(event) => changeCoupon(event.target.value)}
                        aria-describedby="shop-coupon-hint"
                        aria-invalid={couponError ? true : undefined}
                      />
                      <ShopButton variant="outline" type="submit" disabled={!typedCoupon || couponChecking}>
                        {couponChecking ? t.couponChecking : t.couponApply}
                      </ShopButton>
                      {coupon !== "" && (
                        <Button variant="link" className="text-sm" type="button" onClick={() => changeCoupon("")}>
                          {t.couponRemove}
                        </Button>
                      )}
                    </div>
                  </ShopField>
                  <p className="text-sm/[1.7]" role="status">
                    {/* "Can't be used" only once every plan on offer was asked: an unchecked plan may still take the code. */}
                    {applied &&
                      {
                        applied: t.couponApplied(applied.code),
                        refused: t.couponInvalid,
                        unchecked: t.couponUnchecked,
                      }[couponVerdict(applied.quotes, applied.offered)]}
                  </p>
                </form>
              </details>
            )}
          </div>
          {checkoutError && (
            <ShopAlert ref={checkoutAlert} className={cn("scroll-mt-24", shopArriveClass)}>
              {checkoutError}
            </ShopAlert>
          )}
          {/* Each card spans four rows of the shared grid (heading, price, details, actions) through subgrid, so
              prices, detail lists and buttons line up across the cards in a row whatever the description length. */}
          <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-5">
            {plans.map((product, planIndex) => {
              const stripeCurrency = catalog.payment.stripe?.currency;
              const cardPrice =
                stripeCurrency && product.fiatPriceMinor
                  ? formatMoney(product.fiatPriceMinor, stripeCurrency, lang)
                  : null;
              // USDT: hundredths of a USDT, for one mailbox on a seat plan; "12.34 USDT", never Intl's currency style.
              const usdtPayment = catalog.payment.usdt;
              const usdtPrice = usdtPayment && product.usdtPriceMinor ? formatUsdt(product.usdtPriceMinor) : null;
              const selected = product.id === selectedPlan;
              // A plan sold per mailbox: every price of the plan is for one, and the order is priced for the quantity.
              const seatPlan = isSeatProduct(product) ? product : null;
              const seats = seatsOf(product);
              const days = product.periodDays ?? 0;
              // The order's total for either way of paying: mail's quote, or the page's estimate by mail's rule while there is
              // none. Each way has its own limit on what one order can charge: a quantity too many for one is still sold by the other.
              const { ldcFigure, cardFigure, usdtFigure, asking, ...open } = waysOf(product);
              const range = rangeOf(product);
              const figures = [ldcFigure, cardFigure, usdtFigure].filter((figure) => figure !== null);
              // What each total is labelled with: the quote's own currency, period and discount for a quoted total (the
              // catalog can be older than the quote), the catalog's only for the page's estimate.
              const catalogTerms = { periodDays: days, discountPercent: product.discountPercent };
              const ldcTerms = sold(ldcFigure) ? seatTerms(ldcFigure, { ...catalogTerms, currency: "" }) : null;
              const cardTerms = sold(cardFigure)
                ? seatTerms(cardFigure, { ...catalogTerms, currency: stripeCurrency ?? "" })
                : null;
              const usdtTerms = sold(usdtFigure) ? seatTerms(usdtFigure, { ...catalogTerms, currency: "usdt" }) : null;
              const tooMany = figures.length > 0 && figures.every((figure) => figure.kind === "tooMany");
              // The applied code on this plan, per way of paying the card offers: a quote, null (cannot be used) or undefined (not asked).
              const ldcQuote = open.ldc ? applied?.quotes[`${product.id}:ldc:${seats}`] : undefined;
              const cardQuote = open.card ? applied?.quotes[`${product.id}:stripe:${seats}`] : undefined;
              const usdtQuote = open.usdt ? applied?.quotes[`${product.id}:usdt:${seats}`] : undefined;
              const ways = Number(open.ldc) + Number(open.card) + Number(open.usdt);
              const refused = Number(ldcQuote === null) + Number(cardQuote === null) + Number(usdtQuote === null);
              const couponLines = !applied
                ? []
                : [
                    ...(ldcQuote
                      ? [t.couponWith(applied.code, t.couponPriceLdc(formatCredits(ldcQuote.priceCents)))]
                      : []),
                    ...(cardQuote
                      ? [
                          t.couponWith(
                            applied.code,
                            t.couponPriceCard(formatMoney(cardQuote.priceCents, cardQuote.currency, lang)),
                          ),
                        ]
                      : []),
                    ...(usdtQuote
                      ? [t.couponWith(applied.code, t.couponPriceUsdt(formatUsdt(usdtQuote.priceCents)))]
                      : []),
                    ...(ldcQuote?.firstPeriodOnly || cardQuote?.firstPeriodOnly || usdtQuote?.firstPeriodOnly
                      ? [t.couponFirstPeriod]
                      : []),
                    ...(ways > 0 && refused === ways
                      ? [t.couponNotForPlan]
                      : [
                          ...(ldcQuote === null ? [t.couponNotForLdc] : []),
                          ...(cardQuote === null ? [t.couponNotForCard] : []),
                          // mail applies a percentage code to a USDT price, never a fixed amount.
                          ...(usdtQuote === null ? [t.couponNotForUsdt] : []),
                        ]),
                    // Plans that were not asked about (past a press's limit, or after a failure): checkout decides.
                    ...((open.ldc && ldcQuote === undefined) ||
                    (open.card && cardQuote === undefined) ||
                    (open.usdt && usdtQuote === undefined)
                      ? [t.couponAtCheckout]
                      : []),
                  ];
              return (
                <Card
                  asChild
                  variant={selected ? "featured" : "default"}
                  className={cn(
                    "row-span-4 grid scroll-mt-24 grid-rows-subgrid gap-y-0 p-7 max-narrow:px-5 max-narrow:py-[22px]",
                    shopArriveClass,
                  )}
                  // One after another, so the eye is led across the plans.
                  style={{ animationDelay: `${Math.min(planIndex, 5) * 70}ms` }}
                  key={product.id}
                >
                  <article ref={selected ? selectedCard : undefined} aria-current={selected ? "true" : undefined}>
                    <div>
                      {selected && (
                        <Badge variant="brand" className="float-right">
                          {t.planSelected}
                        </Badge>
                      )}
                      {/* The a↗ in the plan card's top-left corner echoes the brand mark: highlight yellow square with ink text. */}
                      <IconTile variant="highlight" className="mb-[22px] size-[38px] text-[22px]" aria-hidden="true">
                        a↗
                      </IconTile>
                      <h3 className="text-xl wrap-anywhere">{product.name}</h3>
                      {product.description && (
                        <p className="mt-3 text-sm/[1.7] whitespace-pre-line wrap-anywhere text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col py-[26px]">
                      {catalog.payment.ldc && (
                        <ShopPrice
                          item={product}
                          purchase
                          unit={seatPlan ? t.seatUnit(days) : undefined}
                          className="my-0"
                        />
                      )}
                      {cardPrice ? (
                        <p
                          className={cn(
                            "text-sm/body",
                            catalog.payment.ldc ? "pt-4 text-muted-foreground" : "font-semibold",
                          )}
                        >
                          {seatPlan ? t.seatCardEach(cardPrice, days) : t.cardPrice(cardPrice, days)}
                        </p>
                      ) : null}
                      {usdtPrice ? (
                        <p
                          className={cn(
                            "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm/body",
                            catalog.payment.ldc || cardPrice
                              ? cn(cardPrice ? "pt-1" : "pt-4", "text-muted-foreground")
                              : "font-semibold",
                          )}
                        >
                          <span>{seatPlan ? t.seatUsdtEach(usdtPrice, days) : t.usdtPrice(usdtPrice, days)}</span>
                          {usdtPayment?.network === "nile" && <ShopTestnetBadge>{t.usdtTestnet}</ShopTestnetBadge>}
                        </p>
                      ) : null}
                      {seatPlan && range && (
                        <div className="mt-4 border-t border-border pt-4">
                          <ShopField
                            htmlFor={`shop-seats-${product.id}`}
                            label={t.seatQuantity}
                            hint={t.seatRange(range.minQuantity, range.maxQuantity)}
                            hintId={`shop-seats-${product.id}-hint`}
                          >
                            <ShopSeatStepper
                              // A range mail corrected starts the field again, with the quantity brought into it.
                              key={`${range.minQuantity}-${range.maxQuantity}`}
                              id={`shop-seats-${product.id}`}
                              value={seats}
                              min={range.minQuantity}
                              max={range.maxQuantity}
                              disabled={buying !== null}
                              fewerLabel={t.seatFewer}
                              moreLabel={t.seatMore}
                              describedBy={`shop-seats-${product.id}-hint`}
                              onChange={(value) => setQuantities((current) => ({ ...current, [product.id]: value }))}
                            />
                          </ShopField>
                          {/* Read out when the quantity changes: the total is what the buyer is deciding on. */}
                          <div className="text-sm/[1.7]" role="status" aria-busy={asking || undefined}>
                            <p className="text-xs/body text-muted-foreground">{t.seatTotal}</p>
                            {tooMany ? (
                              <p className="text-destructive">{t.seatTooMany}</p>
                            ) : (
                              <>
                                {sold(ldcFigure) && ldcTerms && (
                                  // Keyed by the amount: a new total rises in, so a change of quantity is seen to land.
                                  <p className="animate-arrive font-semibold" key={ldcFigure.totalCents}>
                                    {t.seatTotalLdc(formatCredits(ldcFigure.totalCents), ldcTerms.periodDays)}
                                    {ldcFigure.subtotalCents > ldcFigure.totalCents && (
                                      <span className="ml-2 font-normal text-muted-foreground">
                                        <span className="sr-only">{t.seatWas} </span>
                                        <s>{formatCredits(ldcFigure.subtotalCents)} LDC</s>
                                      </span>
                                    )}
                                  </p>
                                )}
                                {/* What each later period costs is mail's number too; said only when it is not the total above. */}
                                {ldcFigure?.kind === "quoted" &&
                                  ldcFigure.renewPriceCents > 0 &&
                                  ldcFigure.renewPriceCents !== ldcFigure.totalCents && (
                                    <p className="text-muted-foreground">
                                      {t.seatRenewsAt(
                                        `${formatCredits(ldcFigure.renewPriceCents)} LDC`,
                                        ldcFigure.periodDays,
                                      )}
                                    </p>
                                  )}
                                {sold(cardFigure) && cardTerms?.currency && (
                                  <p
                                    className={cn(
                                      "animate-arrive",
                                      sold(ldcFigure) ? "text-muted-foreground" : "font-semibold",
                                    )}
                                    key={cardFigure.totalCents}
                                  >
                                    {t.seatTotalCard(
                                      formatMoney(cardFigure.totalCents, cardTerms.currency, lang),
                                      cardTerms.periodDays,
                                    )}
                                  </p>
                                )}
                                {sold(usdtFigure) && usdtTerms && (
                                  <p
                                    className={cn(
                                      "animate-arrive",
                                      sold(ldcFigure) || sold(cardFigure) ? "text-muted-foreground" : "font-semibold",
                                    )}
                                    key={`usdt:${usdtFigure.totalCents}`}
                                  >
                                    {t.seatTotalUsdt(formatUsdt(usdtFigure.totalCents), usdtTerms.periodDays)}
                                  </p>
                                )}
                                {/* Only the way of paying that cannot take this quantity is closed, and says why. */}
                                {ldcFigure?.kind === "tooMany" && (
                                  <p className="text-destructive">{t.seatTooManyLdc}</p>
                                )}
                                {cardFigure?.kind === "tooMany" && (
                                  <p className="text-destructive">{t.seatTooManyCard}</p>
                                )}
                                {usdtFigure?.kind === "tooMany" && (
                                  <p className="text-destructive">{t.seatTooManyUsdt}</p>
                                )}
                                {/* Any other refusal of a quote is mail's own sentence, once when both ways got the same. */}
                                {[
                                  ...new Set(
                                    figures.flatMap((figure) => (figure.kind === "refused" ? [figure.message] : [])),
                                  ),
                                ].map((message) => (
                                  <p className="text-destructive" key={message}>
                                    {message}
                                  </p>
                                ))}
                              </>
                            )}
                          </div>
                          <p className="mt-2 text-xs/[1.6] text-muted-foreground">
                            {ldcTerms &&
                              ldcTerms.discountPercent > 0 &&
                              `${t.seatDiscountNote(ldcTerms.discountPercent)} `}
                            {/* An estimate says so; mail's own total says that instead. */}
                            {figures.some((figure) => figure.kind === "estimate")
                              ? t.seatEstimate
                              : figures.some((figure) => figure.kind === "quoted")
                                ? t.seatQuoted
                                : null}
                          </p>
                        </div>
                      )}
                      {couponLines.length > 0 && (
                        <ul
                          className={cn("mt-4 grid gap-1 border-t border-border pt-4 text-sm/[1.7]", shopArriveClass)}
                        >
                          {couponLines.map((line, index) => (
                            <li
                              className={
                                index <
                                Number(Boolean(ldcQuote)) + Number(Boolean(cardQuote)) + Number(Boolean(usdtQuote))
                                  ? "font-semibold"
                                  : "text-muted-foreground"
                              }
                              key={line}
                            >
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <ShopDetails
                        item={product}
                        lang={lang}
                        seatRange={range ? { min: range.minQuantity, max: range.maxQuantity } : undefined}
                      />
                      {carried && !product.domains.includes(carried.domain) && (
                        <p className="mt-3 text-xs/body text-muted-foreground">{t.planWithoutDomain(carried.domain)}</p>
                      )}
                    </div>
                    {/* Top-aligned: a card whose buttons wrap onto two lines makes the shared row taller, and the
                        buttons of the other cards keep their own height instead of stretching to it. */}
                    <div className="flex flex-wrap content-start items-start gap-2 pt-6">
                      {catalog.payment.ldc && (
                        <ShopButton
                          type="button"
                          loading={buying === `${product.id}:ldc`}
                          disabled={buying !== null || !open.ldc}
                          onClick={() => void checkout(product.id)}
                          aria-label={`${t.buy} · ${product.name}`}
                        >
                          {buying === `${product.id}:ldc` ? t.buying : t.buy}
                          {buying !== `${product.id}:ldc` && <span aria-hidden="true">↗</span>}
                        </ShopButton>
                      )}
                      {cardPrice ? (
                        <ShopButton
                          variant={catalog.payment.ldc ? "outline" : "default"}
                          type="button"
                          loading={buying === `${product.id}:stripe`}
                          disabled={buying !== null || !open.card}
                          onClick={() => void checkout(product.id, "stripe")}
                          aria-label={`${t.payCard} · ${product.name}`}
                        >
                          {buying === `${product.id}:stripe` ? t.buying : t.payCard}
                          {buying !== `${product.id}:stripe` && <span aria-hidden="true">↗</span>}
                        </ShopButton>
                      ) : null}
                      {usdtPrice ? (
                        <ShopButton
                          variant={catalog.payment.ldc || cardPrice ? "outline" : "default"}
                          type="button"
                          loading={buying === `${product.id}:usdt`}
                          disabled={buying !== null || !open.usdt}
                          onClick={() => void checkout(product.id, "usdt")}
                          aria-label={`${t.payUsdt} · ${product.name}`}
                        >
                          {buying === `${product.id}:usdt` ? t.buying : t.payUsdt}
                          {buying !== `${product.id}:usdt` && <span aria-hidden="true">↗</span>}
                        </ShopButton>
                      ) : null}
                    </div>
                  </article>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12 border-t border-border pt-8">
        <h2 className={shopHeadingClass}>{t.processTitle}</h2>
        <ol className="mt-6 grid grid-cols-3 gap-7 max-narrow:grid-cols-[1fr] max-narrow:gap-[18px]">
          {t.steps.map((step, index) => (
            <li className="text-base/[1.8] max-narrow:flex max-narrow:gap-4" key={step}>
              <span className="mb-2.5 block text-xs/[1.8] text-muted-foreground max-narrow:mb-0" aria-hidden="true">
                0{index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className={shopTextClass}>{t.expiryNote}</p>
      </section>
      <p className={shopNoteClass}>{t.browserNote}</p>
    </div>
  );
}
