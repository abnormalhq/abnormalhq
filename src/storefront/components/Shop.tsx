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
  createShopOrder,
  formatCredits,
  getShopCatalog,
  isSeatProduct,
  previewCouponPlans,
  seatCardPrice,
  seatOrderPrice,
  seatTotals,
  ShopApiError,
  type CouponQuote,
  type ShopCatalog,
  formatMoney,
  type ShopPaymentProvider,
} from "@/storefront/lib/shop";
import { COUPON_MAX_LENGTH, couponVerdict, normalizeCoupon, rememberCoupon } from "@/storefront/lib/coupon";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
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
  ShopTextLink,
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

export function Shop({ lang }: { lang: Lang }) {
  const t = shopCopy[lang];
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
  // Fixed plans, then the plans sold per mailbox (the catalog's `seatProducts`; none on a backend without them).
  const plans = catalog ? catalogPlans(catalog) : [];
  const hasSelected = Boolean(selectedPlan && plans.some((product) => product.id === selectedPlan));
  // How many mailboxes of each seat plan: the plan's minimum until the buyer changes it.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const seatsOf = (product: (typeof plans)[number]) =>
    isSeatProduct(product) ? (quantities[product.id] ?? product.seatMin) : 0;

  /** Which ways of paying a plan can be bought with right now: offered by the shop and, for a seat plan, able to take the quantity. */
  const waysOf = (product: (typeof plans)[number]) => {
    const ldc = Boolean(catalog?.payment.ldc);
    const card = Boolean(catalog?.payment.stripe && product.fiatPriceMinor);
    const totals = isSeatProduct(product) ? seatTotals(product, seatsOf(product), { ldc, card }) : null;
    return { ldc: ldc && !totals?.ldcTooMany, card: card && !totals?.cardTooMany, totals };
  };

  useEffect(() => {
    const address = parseAddress(linkedAddress);
    if (address) rememberAddress(address);
  }, [linkedAddress]);

  useEffect(() => {
    if (hasSelected) selectedCard.current?.scrollIntoView({ block: "nearest" });
  }, [hasSelected]);

  useEffect(() => {
    const controller = new AbortController();
    getShopCatalog(controller.signal, lang)
      .then(setCatalog)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(shopError(error, lang));
      });
    return () => controller.abort();
  }, [attempt, lang]);

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
    // whole request for such a total (400), which would read as a backend without the several-plans form.
    const offered = products.flatMap((product) => {
      const open = waysOf(product);
      // The quantity as it is now: the answer is for it, whatever the stepper says by the time it arrives.
      const seats = seatsOf(product);
      return [
        ...(open.ldc ? [{ product, provider: "ldc" as const, seats }] : []),
        ...(open.card ? [{ product, provider: "stripe" as const, seats }] : []),
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
      setCouponError(shopError(result.error, lang));
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
        const baseCents = !product
          ? undefined
          : seats > 0
            ? provider === "stripe"
              ? seatCardPrice(product, seats)
              : seatOrderPrice(product, seats)?.priceCents
            : provider === "stripe"
              ? product.fiatPriceMinor
              : product.priceCents;
        if (baseCents) rememberCoupon({ orderId: id, code: applied?.code ?? typedCoupon.toUpperCase(), baseCents });
      }
      router.push(`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(id)}`);
    } catch (error) {
      setCheckoutError(shopError(error, lang));
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
        <Card className="p-6">
          <h2 className={shopHeadingClass}>{trialCopy[lang].title}</h2>
          <p className={shopTextClass}>{trialCopy[lang].description(catalog.trial.days, catalog.trial.quotaMb)}</p>
          <ShopButton asChild>
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
        <Card asChild className={shopEmptyClass}>
          <p role="status">{t.loading}</p>
        </Card>
      ) : !catalog.available || plans.length === 0 ? (
        <Card className={shopEmptyClass}>
          <h2 className="text-xl">{t.closed}</h2>
          <p className={shopTextClass}>{t.closedDescription}</p>
        </Card>
      ) : (
        <section aria-labelledby="shop-products-title">
          <div>
            <h2 className={shopHeadingClass} id="shop-products-title">
              {t.choose}
            </h2>
            <p className={shopTextClass}>{t.pricing}</p>
          </div>
          {plans.some((product) => product.periodDays) && (
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
          )}
          {carried && (
            <Alert className="my-5 max-w-[640px]">
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
          {couponsOffered && (
            <details className="group/coupon my-5 max-w-[640px]">
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
          {checkoutError && <ShopAlert>{checkoutError}</ShopAlert>}
          {/* Each card spans four rows of the shared grid (heading, price, details, actions) through subgrid, so
              prices, detail lists and buttons line up across the cards in a row whatever the description length. */}
          <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-5">
            {plans.map((product) => {
              const stripeCurrency = catalog.payment.stripe?.currency;
              const cardPrice =
                stripeCurrency && product.fiatPriceMinor
                  ? formatMoney(product.fiatPriceMinor, stripeCurrency, lang)
                  : null;
              const selected = product.id === selectedPlan;
              // A plan sold per mailbox: every price of the plan is for one, and the order is priced for the quantity.
              const seatPlan = isSeatProduct(product) ? product : null;
              const seats = seatsOf(product);
              const days = product.periodDays ?? 0;
              // The order's total by mail's rule (the discount on the whole order, rounded once), and by card. Each way of paying
              // has its own limit on what one order can charge: a quantity too many for one is still sold by the other.
              const { totals, ...open } = waysOf(product);
              const seatLdc = totals?.ldc ?? null;
              const seatCard = totals?.card ?? null;
              // The applied code on this plan, per way of paying the card offers: a quote, null (cannot be used) or undefined (not asked).
              const ldcQuote = open.ldc ? applied?.quotes[`${product.id}:ldc:${seats}`] : undefined;
              const cardQuote = open.card ? applied?.quotes[`${product.id}:stripe:${seats}`] : undefined;
              const ways = Number(open.ldc) + Number(open.card);
              const refused = Number(ldcQuote === null) + Number(cardQuote === null);
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
                    ...(ldcQuote?.firstPeriodOnly || cardQuote?.firstPeriodOnly ? [t.couponFirstPeriod] : []),
                    ...(ways > 0 && refused === ways
                      ? [t.couponNotForPlan]
                      : [
                          ...(ldcQuote === null ? [t.couponNotForLdc] : []),
                          ...(cardQuote === null ? [t.couponNotForCard] : []),
                        ]),
                    // Plans that were not asked about (past a press's limit, or after a failure): checkout decides.
                    ...((open.ldc && ldcQuote === undefined) || (open.card && cardQuote === undefined)
                      ? [t.couponAtCheckout]
                      : []),
                  ];
              return (
                <Card
                  asChild
                  variant={selected ? "featured" : "default"}
                  className="row-span-4 grid scroll-mt-24 grid-rows-subgrid gap-y-0 p-7 max-narrow:px-5 max-narrow:py-[22px]"
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
                          lang={lang}
                          purchase
                          unit={seatPlan ? t.seatUnit(days) : undefined}
                          className="my-0"
                        />
                      )}
                      {cardPrice ? (
                        <p
                          className={cn(
                            "text-sm/body",
                            catalog.payment.ldc ? "mt-auto pt-4 text-muted-foreground" : "font-semibold",
                          )}
                        >
                          {seatPlan ? t.seatCardEach(cardPrice, days) : t.cardPrice(cardPrice, days)}
                        </p>
                      ) : null}
                      {seatPlan && (
                        <div className="mt-4 border-t border-border pt-4">
                          <ShopField
                            htmlFor={`shop-seats-${product.id}`}
                            label={t.seatQuantity}
                            hint={t.seatRange(seatPlan.seatMin, seatPlan.seatMax)}
                            hintId={`shop-seats-${product.id}-hint`}
                          >
                            <ShopSeatStepper
                              id={`shop-seats-${product.id}`}
                              value={seats}
                              min={seatPlan.seatMin}
                              max={seatPlan.seatMax}
                              disabled={buying !== null}
                              fewerLabel={t.seatFewer}
                              moreLabel={t.seatMore}
                              describedBy={`shop-seats-${product.id}-hint`}
                              onChange={(value) => setQuantities((current) => ({ ...current, [product.id]: value }))}
                            />
                          </ShopField>
                          {/* Read out when the quantity changes: the total is what the buyer is deciding on. */}
                          <div className="text-sm/[1.7]" role="status">
                            <p className="text-xs/body text-muted-foreground">{t.seatTotal}</p>
                            {totals?.tooMany ? (
                              <p className="text-destructive">{t.seatTooMany}</p>
                            ) : (
                              <>
                                {seatLdc && (
                                  <p className="font-semibold">
                                    {t.seatTotalLdc(formatCredits(seatLdc.priceCents), days)}
                                    {seatLdc.originalPriceCents > seatLdc.priceCents && (
                                      <span className="ml-2 font-normal text-muted-foreground">
                                        <span className="sr-only">{t.seatWas} </span>
                                        <s>{formatCredits(seatLdc.originalPriceCents)} LDC</s>
                                      </span>
                                    )}
                                  </p>
                                )}
                                {seatCard && stripeCurrency && (
                                  <p className={seatLdc ? "text-muted-foreground" : "font-semibold"}>
                                    {t.seatTotalCard(formatMoney(seatCard, stripeCurrency, lang), days)}
                                  </p>
                                )}
                                {/* Only the way of paying that cannot take this quantity is closed, and says why. */}
                                {totals?.ldcTooMany && <p className="text-destructive">{t.seatTooManyLdc}</p>}
                                {totals?.cardTooMany && <p className="text-destructive">{t.seatTooManyCard}</p>}
                              </>
                            )}
                          </div>
                          <p className="mt-2 text-xs/[1.6] text-muted-foreground">
                            {seatLdc &&
                              product.discountPercent > 0 &&
                              `${t.seatDiscountNote(product.discountPercent)} `}
                            {t.seatEstimate}
                          </p>
                        </div>
                      )}
                      {couponLines.length > 0 && (
                        <ul className="mt-4 grid gap-1 border-t border-border pt-4 text-sm/[1.7]">
                          {couponLines.map((line, index) => (
                            <li
                              className={
                                index < Number(Boolean(ldcQuote)) + Number(Boolean(cardQuote))
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
                        seatRange={seatPlan ? { min: seatPlan.seatMin, max: seatPlan.seatMax } : undefined}
                      />
                      {carried && !product.domains.includes(carried.domain) && (
                        <p className="mt-3 text-xs/body text-muted-foreground">{t.planWithoutDomain(carried.domain)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-6">
                      {catalog.payment.ldc && (
                        <ShopButton
                          type="button"
                          disabled={buying !== null || Boolean(totals?.ldcTooMany)}
                          onClick={() => void checkout(product.id)}
                          aria-label={`${t.buy} · ${product.name}`}
                        >
                          {buying === `${product.id}:ldc` ? t.buying : t.buy}
                          <span aria-hidden="true">↗</span>
                        </ShopButton>
                      )}
                      {cardPrice ? (
                        <ShopButton
                          variant={catalog.payment.ldc ? "outline" : "default"}
                          type="button"
                          disabled={buying !== null || Boolean(totals?.cardTooMany)}
                          onClick={() => void checkout(product.id, "stripe")}
                          aria-label={`${t.payCard} · ${product.name}`}
                        >
                          {buying === `${product.id}:stripe` ? t.buying : t.payCard}
                          <span aria-hidden="true">↗</span>
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
