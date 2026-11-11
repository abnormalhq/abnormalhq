"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import {
  createRenewalOrder,
  clampSeats,
  formatCredits,
  formatMoney,
  type ShopPaymentProvider,
  formatDateTime,
  getRenewal,
  type RenewalSummary,
} from "@/storefront/lib/shop";
import { QuoteBoard, upgradePeriodPrices, viewOf } from "@/storefront/lib/quote";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopField,
  ShopHero,
  ShopMailboxes,
  ShopMeta,
  ShopMetaRow,
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
  shopPriceUnitClass,
  shopTextClass,
} from "./ShopParts";
import { COUPON_MAX_LENGTH, normalizeCoupon } from "@/storefront/lib/coupon";
import { paidPeriodLimit, trialCopy } from "@/storefront/lib/trial";
import { ShopSession } from "./ShopSession";

export function ShopRenew({ lang }: { lang: Lang }) {
  const token = useSearchParams().get("t") ?? "";
  return <ShopRenewContent key={token} lang={lang} token={token} />;
}

/** When the renewal link cannot be opened (404) and the backend gives no explanation, say the link is no longer valid. */
function renewalError(error: unknown, lang: Lang): string {
  return shopError(error, lang, { notFound: shopCopy[lang].renewInvalid });
}

function ShopRenewContent({ lang, token }: { lang: Lang; token: string }) {
  const t = shopCopy[lang];
  const router = useRouter();
  const [summary, setSummary] = useState<RenewalSummary | null>(null);
  const [loadError, setLoadError] = useState(token ? "" : t.renewInvalid);
  const [error, setError] = useState("");
  const [periods, setPeriods] = useState(1);
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(2);
  const trial = trialCopy[lang];
  const selected = summary?.trial ? summary.upgradePlans?.find((plan) => plan.id === productId) : undefined;
  const periodDays = selected?.periodDays ?? summary?.periodDays ?? 30;
  const currency = selected ? summary?.upgradePayment?.stripe?.currency : summary?.currency;
  // An upgrade to a seat plan is priced by mail for the seats chosen (POST /api/shop/quote, one request for every way of
  // paying on offer; src/storefront/lib/quote.ts). The board asks again when the plan or the seats change, after a pause and
  // cancelling what was asked before; without a quote (a mail before the endpoint, one on its way, the rate limit, a
  // refusal) the page works the same figures out itself, as it did before. No discount code goes with the quote: `renew` applies it.
  const [board] = useState(() => new QuoteBoard({ lang }));
  const quotes = useSyncExternalStore(board.subscribe, board.snapshot, board.snapshot);
  useEffect(() => () => board.clear(), [board]);
  const upgradeId = selected?.id ?? "";
  const quoteLdc = Boolean(selected && summary?.upgradePayment?.ldc);
  const quoteCard = Boolean(selected && currency && selected.fiatPriceMinor > 0);
  useEffect(() => {
    const providers: ShopPaymentProvider[] = [
      ...(quoteLdc ? ["ldc" as const] : []),
      ...(quoteCard ? ["stripe" as const] : []),
    ];
    if (providers.length > 0) board.want("upgrade", { productId: upgradeId, providers, quantity });
    else board.drop("upgrade");
  }, [board, upgradeId, quantity, quoteLdc, quoteCard]);
  const upgrade = selected
    ? upgradePeriodPrices(
        selected,
        quantity,
        quoteLdc ? viewOf(quotes, "upgrade", selected.id, quantity, "ldc") : undefined,
        quoteCard ? viewOf(quotes, "upgrade", selected.id, quantity, "stripe") : undefined,
      )
    : null;
  const baseLdc = upgrade ? upgrade.firstLdcCents : (summary?.renewPriceCents ?? 0);
  const ldcRenewal = upgrade ? upgrade.renewLdcCents : (summary?.renewPriceCents ?? 0);
  const cardPeriod = upgrade ? upgrade.cardCents : (summary?.fiatRenewMinor ?? 0);
  const ldcTotal = baseLdc + ldcRenewal * (periods - 1);
  const cardTotal = cardPeriod * periods;
  const ldcMaxPeriods = selected
    ? summary?.upgradePayment?.ldc
      ? paidPeriodLimit(baseLdc, ldcRenewal)
      : 0
    : (summary?.maxPeriods ?? 0);
  const cardMaxPeriods = currency ? paidPeriodLimit(cardPeriod, cardPeriod) : 0;
  const maxPeriods = Math.max(ldcMaxPeriods, cardMaxPeriods);
  const expired = Boolean(summary?.trial && summary.state === "expired");
  const [creating, setCreating] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getRenewal(token, controller.signal, lang)
      .then(setSummary)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(renewalError(cause, lang));
      });
    return () => controller.abort();
  }, [token, lang]);

  async function submit(provider: ShopPaymentProvider = "ldc") {
    if (lock.current) return;
    lock.current = true;
    setCreating(true);
    setError("");
    try {
      const id = await createRenewalOrder(
        token,
        periods,
        lang,
        email.trim(),
        provider,
        summary?.trial ? normalizeCoupon(coupon) : "",
        selected ? { productId: selected.id, quantity } : undefined,
      );
      router.push(`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(renewalError(cause, lang));
      setCreating(false);
      lock.current = false;
    }
  }

  const date = (value: string) => formatDateTime(value, lang);

  return (
    <div className={shopOrderPageClass}>
      <ShopTextLink href={`/${LANG_PATHS[lang]}shop/`}>← {t.backToShop}</ShopTextLink>
      <ShopSession lang={lang} />
      <ShopHero
        eyebrow={summary?.trial ? trial.upgradeOrder : t.renewEyebrow}
        title={summary?.trial ? trial.upgradeTitle : t.renewTitle}
      >
        {summary?.trial ? trialCopy[lang].expiry : t.renewDescription}
      </ShopHero>
      {loadError ? (
        <Card asChild className={shopEmptyClass}>
          <div>
            <p className={shopTextClass} role="alert">
              {loadError}
            </p>
          </div>
        </Card>
      ) : !summary ? (
        <Card asChild className={shopEmptyClass}>
          <p role="status">{t.loading}</p>
        </Card>
      ) : (
        <>
          <ShopPanel>
            <div className={shopHeadingRowClass}>
              <h2 className={shopHeadingClass}>{summary.productName}</h2>
              <ShopStatus active={summary.state === "active"}>{t.subscriptionStates[summary.state]}</ShopStatus>
            </div>
            {summary.trial && <p className={shopTextClass}>{trialCopy[lang].manual}</p>}
            <ShopMeta>
              <ShopMetaRow label={t.subscriptionEnds}>{date(summary.currentPeriodEnd)}</ShopMetaRow>
              <ShopMetaRow label={summary.trial ? trial.paidPeriod : t.period}>
                {t.periodValue(summary.periodDays)}
                <br />
                {t.renewAt(formatCredits(summary.renewPriceCents))}
              </ShopMetaRow>
              <ShopMetaRow label={t.renewMailboxes}>
                {summary.mailboxes.length > 0 ? <ShopMailboxes mailboxes={summary.mailboxes} /> : t.noMailboxes}
              </ShopMetaRow>
            </ShopMeta>
          </ShopPanel>
          {expired ? (
            <ShopAlert>{trial.unavailable}</ShopAlert>
          ) : summary.provider === "stripe" ? (
            <ShopPanel>
              <p className={shopTextClass}>{t.renewalStripeNote}</p>
              <ShopActions>
                <ShopButton asChild>
                  <Link href={`/${LANG_PATHS[lang]}shop/account/`}>
                    {t.manageInAccount}
                    <span aria-hidden="true">↗</span>
                  </Link>
                </ShopButton>
              </ShopActions>
            </ShopPanel>
          ) : (
            <ShopPanel>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const button = (event.nativeEvent as SubmitEvent).submitter;
                  void submit(button instanceof HTMLButtonElement && button.value === "stripe" ? "stripe" : "ldc");
                }}
              >
                {summary.trial && (summary.upgradePlans?.length ?? 0) > 0 && (
                  <>
                    <ShopField
                      htmlFor="shop-upgrade-plan"
                      label={trial.choosePlan}
                      hint={trial.chooseTeam}
                      hintId="shop-upgrade-plan-hint"
                    >
                      <NativeSelect
                        id="shop-upgrade-plan"
                        className={cn(shopInputClass, "max-w-[640px]")}
                        value={productId}
                        disabled={creating}
                        onChange={(event) => {
                          const id = event.target.value;
                          setProductId(id);
                          setQuantity(summary.upgradePlans?.find((plan) => plan.id === id)?.seatMin ?? 2);
                          setPeriods(1);
                        }}
                      >
                        <option value="">
                          {trial.keepPlan} · {summary.productName}
                        </option>
                        {summary.upgradePlans?.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </ShopField>
                    {selected && (
                      <>
                        <p className={shopTextClass}>{trial.planSummary(selected.quotaMb, selected.customDomains)}</p>
                        <ShopField htmlFor="shop-upgrade-seats" label={trial.seats}>
                          <Input
                            id="shop-upgrade-seats"
                            type="number"
                            min={selected.seatMin}
                            max={selected.seatMax}
                            step={1}
                            className={cn(shopInputClass, "max-w-[200px]")}
                            value={quantity}
                            onChange={(event) => setQuantity(clampSeats(Number(event.target.value), selected))}
                            disabled={creating}
                          />
                        </ShopField>
                      </>
                    )}
                  </>
                )}
                <ShopField htmlFor="shop-renew-periods" label={summary.trial ? trial.paidPeriod : t.periodsLabel}>
                  <NativeSelect
                    className={cn(
                      shopInputClass,
                      "max-w-[420px] text-base/[normal] hover:border-input disabled:opacity-70 [&_option]:bg-transparent",
                    )}
                    id="shop-renew-periods"
                    value={periods}
                    onChange={(event) => setPeriods(Number(event.target.value))}
                    disabled={creating}
                  >
                    {Array.from({ length: Math.max(1, maxPeriods) }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {t.periodsOption(count, periodDays)}
                      </option>
                    ))}
                  </NativeSelect>
                </ShopField>
                <ShopField
                  htmlFor="shop-renew-email"
                  label={t.emailLabel}
                  hint={summary.hasContactEmail ? t.renewContactSaved : t.emailHint}
                  hintId="shop-renew-email-hint"
                >
                  <Input
                    className={cn(shopInputClass, "max-w-[420px]")}
                    id="shop-renew-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={creating}
                    aria-describedby="shop-renew-email-hint"
                  />
                </ShopField>
                {summary.trial && (
                  <ShopField
                    htmlFor="shop-upgrade-coupon"
                    label={trialCopy[lang].couponLabel}
                    hint={trialCopy[lang].couponHint}
                    hintId="shop-upgrade-coupon-hint"
                  >
                    <Input
                      id="shop-upgrade-coupon"
                      className={cn(shopInputClass, "max-w-[420px]")}
                      value={coupon}
                      onChange={(event) => setCoupon(event.target.value)}
                      maxLength={COUPON_MAX_LENGTH}
                      disabled={creating}
                      placeholder="WELCOME10"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-describedby="shop-upgrade-coupon-hint"
                    />
                  </ShopField>
                )}
                <p className={shopPriceLineClass}>
                  <span className={shopPriceUnitClass}>{summary.trial ? trial.estimate : t.total}</span>
                  <strong className={shopPriceAmountClass}>{formatCredits(ldcTotal)}</strong>
                  <span className={shopPriceUnitClass}>LDC</span>
                </p>
                {Boolean(cardPeriod && currency) && (
                  <p className={shopTextClass}>
                    {trialCopy[lang].card}: {formatMoney(cardTotal, currency ?? "usd", lang)}
                  </p>
                )}
                {selected && (
                  <p className={shopTextClass}>
                    {trial.regularRenewal} {t.renewAt(formatCredits(ldcRenewal))}
                    {currency && cardPeriod ? ` / ${formatMoney(cardPeriod, currency, lang)}` : ""}
                  </p>
                )}
                {error && <ShopAlert>{error}</ShopAlert>}
                <ShopActions>
                  <ShopButton type="submit" name="provider" value="ldc" disabled={creating || periods > ldcMaxPeriods}>
                    {creating
                      ? t.renewing
                      : summary.trial || summary.fiatRenewMinor
                        ? trialCopy[lang].credits
                        : t.renewButton}
                    <span aria-hidden="true">↗</span>
                  </ShopButton>
                  {Boolean(cardPeriod && currency) && (
                    <ShopButton
                      type="submit"
                      name="provider"
                      value="stripe"
                      disabled={creating || periods > cardMaxPeriods}
                    >
                      {creating ? t.renewing : trialCopy[lang].card}
                    </ShopButton>
                  )}
                </ShopActions>
              </form>
            </ShopPanel>
          )}
        </>
      )}
      <p className={shopNoteClass}>{t.browserNote}</p>
    </div>
  );
}
