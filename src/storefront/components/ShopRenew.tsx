"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import {
  createRenewalOrder,
  formatCredits,
  formatDateTime,
  getRenewal,
  type RenewalSummary,
} from "@/storefront/lib/shop";
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

  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setCreating(true);
    setError("");
    try {
      const id = await createRenewalOrder(token, periods, lang, email.trim());
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
      <ShopHero eyebrow={t.renewEyebrow} title={t.renewTitle}>
        {t.renewDescription}
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
            <ShopMeta>
              <ShopMetaRow label={t.subscriptionEnds}>{date(summary.currentPeriodEnd)}</ShopMetaRow>
              <ShopMetaRow label={t.period}>
                {t.periodValue(summary.periodDays)}
                <br />
                {t.renewAt(formatCredits(summary.renewPriceCents))}
              </ShopMetaRow>
              <ShopMetaRow label={t.renewMailboxes}>
                {summary.mailboxes.length > 0 ? <ShopMailboxes mailboxes={summary.mailboxes} /> : t.noMailboxes}
              </ShopMetaRow>
            </ShopMeta>
          </ShopPanel>
          {summary.provider === "stripe" ? (
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
                  void submit();
                }}
              >
                <ShopField htmlFor="shop-renew-periods" label={t.periodsLabel}>
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
                    {Array.from({ length: Math.max(1, summary.maxPeriods) }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {t.periodsOption(count, summary.periodDays)}
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
                <p className={shopPriceLineClass}>
                  <span className={shopPriceUnitClass}>{t.total}</span>
                  <strong className={shopPriceAmountClass}>{formatCredits(summary.renewPriceCents * periods)}</strong>
                  <span className={shopPriceUnitClass}>LDC</span>
                </p>
                {error && <ShopAlert>{error}</ShopAlert>}
                <ShopActions>
                  <ShopButton type="submit" disabled={creating || summary.maxPeriods < 1}>
                    {creating ? t.renewing : t.renewButton}
                    <span aria-hidden="true">↗</span>
                  </ShopButton>
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
