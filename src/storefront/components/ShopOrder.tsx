"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LANG_PATHS, storePath, type Lang } from "@/storefront/i18n";
import {
  getShopOrder,
  reconcileShopOrder,
  shopApiRoot,
  type PublicShopOrder,
  formatCredits,
  formatDateTime,
  formatMoney,
} from "@/storefront/lib/shop";
import { orderCoupon, recallCoupon } from "@/storefront/lib/coupon";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { withBase } from "@/storefront/site";
import { copyText } from "./onboard/clipboard";
import { ShopDetails } from "./ShopDetails";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopHero,
  ShopMeta,
  ShopMetaRow,
  ShopOrderCode,
  ShopPanel,
  ShopStatus,
  ShopTextLink,
  shopEmptyClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopNoteClass,
  shopOrderPageClass,
  shopPriceAmountClass,
  shopPriceLineClass,
  shopTextClass,
} from "./ShopParts";
import { ShopPrice } from "./ShopPrice";
import { ShopSession } from "./ShopSession";
import { trialCopy } from "@/storefront/lib/trial";
import { ShopStripeCheckout } from "./ShopStripeCheckout";

export function ShopOrder({ lang }: { lang: Lang }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id") ?? "";
  return (
    <ShopOrderContent
      key={orderId}
      lang={lang}
      orderId={orderId}
      paymentError={searchParams.get("error") === "payment"}
    />
  );
}

/** The remembered code never changes while the order page is open; it is read once the page runs in the browser. */
const noSubscription = () => () => {};

function ShopOrderContent({ lang, orderId, paymentError }: { lang: Lang; orderId: string; paymentError: boolean }) {
  const t = shopCopy[lang];
  const validId = /^[a-z0-9]{15}$/.test(orderId);
  const [result, setResult] = useState<PublicShopOrder | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const checkLock = useRef(false);
  const [attempt, setAttempt] = useState(0);
  // A card order is paid on this page with Stripe Elements by default; without a publishable key in the backend, or when the form cannot load, the "Pay with Stripe" form takes over.
  const [hostedCard, setHostedCard] = useState(false);
  // Each time the buyer pays on this page, polling starts over (the first round may have run out while they typed the card).
  const [pollRound, setPollRound] = useState(0);
  const order = result?.order;
  const paid = order?.status === "paid";
  const pending = order?.status === "pending";
  const renewal = order?.kind === "renewal";
  const embeddedCard = order?.provider === "stripe" && !hostedCard;
  // The discount code of this order: mail's own fields once it publishes them, until then what the shop page remembered at
  // checkout, as text so the store's value is stable (src/storefront/lib/coupon.ts).
  const remembered = useSyncExternalStore(
    noSubscription,
    () => JSON.stringify(recallCoupon(orderId)),
    () => "null",
  );
  const couponUsed = order ? orderCoupon(order, JSON.parse(remembered) as ReturnType<typeof recallCoupon>) : null;
  const amount = (cents: number) =>
    order?.provider === "stripe" ? formatMoney(cents, order.currency ?? "", lang) : `${formatCredits(cents)} LDC`;

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    getShopOrder(orderId, controller.signal, lang)
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(shopError(cause, lang, { notFound: t.notFound }));
      });
    return () => controller.abort();
  }, [orderId, validId, attempt, lang, t]);

  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    let attempts = 0;
    let timer = 0;

    async function poll() {
      if (controller.signal.aborted) return;
      if (document.visibilityState === "visible" && !checkLock.current) {
        attempts += 1;
        try {
          const next = await getShopOrder(orderId, controller.signal, lang);
          if (controller.signal.aborted) return;
          // A slower poll must not replace a payment confirmed by a manual check.
          setResult((current) => (current?.order.status === "paid" ? current : next));
          if (next.order.status === "paid") return;
        } catch {
          // Transient background failures leave the manual check available.
          if (controller.signal.aborted) return;
        }
      }
      if (attempts < 12) timer = window.setTimeout(() => void poll(), 5000);
    }

    timer = window.setTimeout(() => void poll(), 5000);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [orderId, pending, lang, pollRound]);

  async function reconcile() {
    if (checkLock.current) return;
    checkLock.current = true;
    setChecking(true);
    setError("");
    setNotice("");
    try {
      await reconcileShopOrder(orderId, lang);
      const next = await getShopOrder(orderId, undefined, lang);
      setResult((current) => (current?.order.status === "paid" ? current : next));
      if (next.order.status !== "paid") setNotice(t.checked);
    } catch (cause) {
      setError(shopError(cause, lang, { notFound: t.notFound }));
    } finally {
      setChecking(false);
      checkLock.current = false;
    }
  }

  const date = (value: string) => formatDateTime(value, lang);

  return (
    <div className={shopOrderPageClass}>
      <ShopTextLink href={`/${LANG_PATHS[lang]}shop/`}>← {t.backToShop}</ShopTextLink>
      <ShopSession
        lang={lang}
        onSignedOut={() => {
          // This order may only be visible to the account: re-read it after logging out.
          setResult(null);
          setError("");
          setAttempt((value) => value + 1);
        }}
      />
      <ShopHero
        eyebrow={renewal ? t.renewalLabel : t.orderLabel}
        title={
          order?.trial
            ? trialCopy[lang].title
            : renewal
              ? paid
                ? t.renewalPaidTitle
                : t.renewalOrderTitle
              : paid
                ? t.paidTitle
                : t.orderTitle
        }
      >
        {order?.trial
          ? trialCopy[lang].expiry
          : renewal
            ? paid
              ? t.renewalPaidDescription
              : t.renewalOrderDescription
            : paid
              ? t.paidDescription
              : order?.provider === "stripe"
                ? hostedCard
                  ? t.orderDescriptionStripeHosted
                  : t.orderDescriptionStripe
                : t.orderDescription}
      </ShopHero>
      {!validId ? (
        <ShopPanel>
          <h2 className={shopHeadingClass}>{t.search}</h2>
          <p className={shopTextClass}>{t.searchHint}</p>
          {paymentError && <ShopAlert>{t.paymentError}</ShopAlert>}
          {orderId && <ShopAlert>{t.invalidId}</ShopAlert>}
          <form method="get" action={withBase(`${LANG_PATHS[lang]}shop/orders/`)} className="mt-6 grid gap-3">
            <Label className="block text-sm/body font-normal" htmlFor="shop-order-id">
              {t.orderId}
            </Label>
            <Input
              className={cn(shopInputClass, "hover:border-[color-mix(in_oklab,var(--input),var(--text)_15%)]")}
              id="shop-order-id"
              name="id"
              required
              pattern="[a-z0-9]{15}"
              maxLength={15}
              autoComplete="off"
              defaultValue={orderId}
            />
            <ShopButton type="submit">{t.searchButton}</ShopButton>
          </form>
        </ShopPanel>
      ) : !result ? (
        <Card asChild className={shopEmptyClass}>
          <div>
            {error ? (
              <>
                <p className={shopTextClass} role="alert">
                  {error}
                </p>
                <ShopButton
                  variant="outline"
                  className="mt-[18px]"
                  onClick={() => {
                    setError("");
                    setAttempt((value) => value + 1);
                  }}
                >
                  {t.retry}
                </ShopButton>
              </>
            ) : (
              <p className={shopTextClass} role="status">
                {t.loading}
              </p>
            )}
          </div>
        </Card>
      ) : order ? (
        <>
          {!paid && paymentError && !embeddedCard && (
            <ShopAlert>
              {t.paymentError}
              {/* mail publishes an order that adds seats as a renewal order, and refuses to open its payment once the subscription
                  was renewed after it was priced: the page cannot tell the two apart, so it says what to do in that case. */}
              {renewal && (
                <>
                  {" "}
                  {t.seatsOrderHint}{" "}
                  <Link className="underline underline-offset-4" href={`/${LANG_PATHS[lang]}shop/account/`}>
                    {t.accountNav}
                  </Link>
                </>
              )}
            </ShopAlert>
          )}
          <ShopPanel>
            <div className={shopHeadingRowClass}>
              <h2 className={shopHeadingClass}>{order.productName}</h2>
              <ShopStatus active={paid}>{order.trial ? trialCopy[lang].title : paid ? t.paid : t.pending}</ShopStatus>
            </div>
            {order.trial ? (
              <p className={shopTextClass}>{trialCopy[lang].title}</p>
            ) : order.provider === "stripe" ? (
              // Without the currency the amount cannot be read: show none rather than a guessed one.
              order.currency && (
                <p className={cn(shopPriceLineClass, "mt-[26px]", couponUsed ? "mb-0" : "mb-[26px]")}>
                  <strong className={shopPriceAmountClass}>
                    {formatMoney(order.priceCents, order.currency, lang)}
                  </strong>
                </p>
              )
            ) : (
              <ShopPrice item={order} lang={lang} className={couponUsed ? "mb-0" : undefined} />
            )}
            {couponUsed && (order.provider !== "stripe" || order.currency) && (
              // What the code took off, and the price before it: without this an order with a code looks like a plain
              // lower price (mail publishes such an order's original price as the price paid).
              <p className="mt-3 mb-[26px] flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs/body text-muted-foreground">
                <Badge variant="brand" className="h-auto border-0 py-[3px] text-xs/body font-semibold">
                  {t.orderCoupon(couponUsed.code)}
                </Badge>
                <span className="text-foreground">−{amount(couponUsed.discountCents)}</span>
                <span>
                  <span className="sr-only">{t.orderCouponBase} </span>
                  <s>{amount(couponUsed.baseCents)}</s>
                </span>
                {Boolean(order.periodDays) && <span className="basis-full">{t.couponFirstPeriod}</span>}
              </p>
            )}
            {renewal ? (
              <p className={shopTextClass}>{t.renewalPeriods(order.periods ?? 1, order.periodDays ?? 0)}</p>
            ) : (
              <ShopDetails
                item={order}
                lang={lang}
                stripeCurrency={order.provider === "stripe" ? (order.currency ?? "") : undefined}
              />
            )}
            <ShopMeta>
              <ShopMetaRow label={t.orderId}>
                <ShopOrderCode>{order.id}</ShopOrderCode>
              </ShopMetaRow>
              <ShopMetaRow label={t.createdAt}>{date(order.created)}</ShopMetaRow>
              {order.paidAt && <ShopMetaRow label={t.paidAt}>{date(order.paidAt)}</ShopMetaRow>}
            </ShopMeta>
          </ShopPanel>
          {paid && renewal ? null : paid ? (
            <ShopPanel>
              <h2 className={shopHeadingClass}>{t.codeTitle}</h2>
              {result.code ? (
                <>
                  <code className="mt-6 block rounded-mark border border-dashed border-border bg-surface px-[18px] py-[26px] text-center font-mono text-[clamp(16px,3vw,24px)] tracking-[0.06em] wrap-anywhere select-all">
                    {result.code}
                  </code>
                  {result.codeStatus && result.codeStatus in t.statuses && (
                    <p className={shopTextClass}>
                      {t.codeStatus}：{t.statuses[result.codeStatus]}
                    </p>
                  )}
                  <p className={shopTextClass}>{t.expiryNote}</p>
                  {result.codeStatus === "available" && <p className={shopTextClass}>{t.setUpInAccountNote}</p>}
                  <ShopActions>
                    <ShopButton
                      variant="outline"
                      type="button"
                      onClick={async () => setCopyNotice((await copyText(result.code!)) ? t.copied : t.copyFailed)}
                    >
                      {t.copy}
                    </ShopButton>
                    {result.codeStatus === "available" && (
                      <>
                        <ShopButton asChild>
                          <Link href={`/${LANG_PATHS[lang]}shop/account/`}>
                            {t.setUpInAccount}
                            <span aria-hidden="true">↗</span>
                          </Link>
                        </ShopButton>
                        <ShopButton asChild variant="outline">
                          <Link href={storePath(lang)}>
                            {t.redeem}
                            <span aria-hidden="true">↗</span>
                          </Link>
                        </ShopButton>
                      </>
                    )}
                  </ShopActions>
                  <p className={shopTextClass} role="status">
                    {copyNotice}
                  </p>
                </>
              ) : order.trial ? (
                <>
                  <p className={shopTextClass}>{trialCopy[lang].claimed}</p>
                  <ShopButton asChild>
                    <Link href={`/${LANG_PATHS[lang]}shop/account/`}>{t.setUpInAccount}</Link>
                  </ShopButton>
                </>
              ) : (
                <p className={shopTextClass} role="alert">
                  {t.codeMissing}
                </p>
              )}
            </ShopPanel>
          ) : embeddedCard ? (
            <ShopPanel>
              <h2 className={shopHeadingClass}>{t.cardTitle}</h2>
              <p className={shopTextClass}>{t.cardNote}</p>
              <ShopStripeCheckout
                orderId={order.id}
                lang={lang}
                onPaid={async () => {
                  setPollRound((value) => value + 1);
                  await reconcile();
                }}
                onHosted={() => setHostedCard(true)}
              />
              <ShopActions>
                <ShopButton variant="outline" type="button" disabled={checking} onClick={() => void reconcile()}>
                  {checking ? t.refreshing : t.refresh}
                </ShopButton>
              </ShopActions>
              {error && <ShopAlert>{error}</ShopAlert>}
              <p className={shopTextClass} role="status">
                {notice}
              </p>
            </ShopPanel>
          ) : (
            <ShopPanel>
              <h2 className={shopHeadingClass}>{order.provider === "stripe" ? t.payStripe : t.pay}</h2>
              <p className={shopTextClass}>{order.provider === "stripe" ? t.stripePaymentNote : t.paymentNote}</p>
              <ShopActions>
                <form method="post" action={`${shopApiRoot}/pay`}>
                  <input type="hidden" name="orderId" value={order.id} />
                  {/* Page language: mail uses it to send payment, cancellation and failure back to the order page in this language, and the Worker uses it when turning a failure into a redirect. */}
                  <input type="hidden" name="lang" value={lang} />
                  <ShopButton type="submit" disabled={checking}>
                    {order.provider === "stripe" ? t.payStripe : t.pay}
                    <span aria-hidden="true">↗</span>
                  </ShopButton>
                </form>
                <ShopButton variant="outline" type="button" disabled={checking} onClick={() => void reconcile()}>
                  {checking ? t.refreshing : t.refresh}
                </ShopButton>
              </ShopActions>
              {error && <ShopAlert>{error}</ShopAlert>}
              <p className={shopTextClass} role="status">
                {notice}
              </p>
            </ShopPanel>
          )}
          {paid && result.subscription && (
            <ShopPanel>
              <h2 className={shopHeadingClass}>{t.subscriptionTitle}</h2>
              <ShopMeta>
                <ShopMetaRow label={t.subscriptionEnds}>{date(result.subscription.currentPeriodEnd)}</ShopMetaRow>
                <ShopMetaRow label={t.subscriptionState}>
                  {t.subscriptionStates[result.subscription.state]}
                  {result.subscription.provider === "stripe" &&
                    ` · ${result.subscription.autoRenew ? t.autoRenewOn : t.autoRenewOff}`}
                </ShopMetaRow>
              </ShopMeta>
              {result.subscription.provider === "stripe" ? (
                <>
                  <p className={shopTextClass}>
                    {result.subscription.autoRenew ? t.autoRenewNote : t.autoRenewOffNote}
                  </p>
                  <ShopActions>
                    <ShopButton asChild variant="outline">
                      <Link href={`/${LANG_PATHS[lang]}shop/account/`}>
                        {t.manageInAccount}
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </ShopButton>
                  </ShopActions>
                </>
              ) : result.subscription.renewToken ? (
                <>
                  <p className={shopTextClass}>{t.renewNote}</p>
                  <ShopActions>
                    <ShopButton asChild variant="outline">
                      <Link
                        href={`/${LANG_PATHS[lang]}shop/renew/?t=${encodeURIComponent(result.subscription.renewToken)}`}
                      >
                        {t.renewLink}
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </ShopButton>
                  </ShopActions>
                </>
              ) : null}
            </ShopPanel>
          )}
        </>
      ) : null}
      <p className={shopNoteClass}>{t.browserNote}</p>
    </div>
  );
}
