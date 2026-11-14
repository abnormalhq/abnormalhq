import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/storefront/i18n";
import { useShopCopy } from "./copy/context";
import type { ReactNode } from "react";
import { formatCredits, formatMoney, formatUsdt, type ShopProduct } from "@/storefront/lib/shop";

export function ShopDetails({
  item,
  lang,
  stripeCurrency,
  usdt = false,
  seatRange,
}: {
  item: Pick<
    ShopProduct,
    | "mailboxCount"
    | "quotaMb"
    | "quotaSupportedByDomain"
    | "codeExpiresDays"
    | "domains"
    | "periodDays"
    | "renewPriceCents"
    | "priceCents"
    | "customDomains"
  > & { trial?: boolean };
  lang: Lang;
  /** Stripe order: the renewal price is a fiat amount in this currency, not LDC. Empty when the backend did not say which: no renewal price is shown then. */
  stripeCurrency?: string;
  /** USDT order: the renewal price is in hundredths of a USDT, and it renews with USDT. */
  usdt?: boolean;
  /** A seat plan on the shop page: the buyer chooses how many mailboxes, and every price is for one of them. */
  seatRange?: { min: number; max: number };
}) {
  const t = useShopCopy();
  const noQuotaDomains = item.domains.filter((domain) => item.quotaSupportedByDomain?.[domain] === false);
  const quota =
    noQuotaDomains.length > 0 && noQuotaDomains.length === item.domains.length
      ? t.noHardQuota
      : noQuotaDomains.length > 0
        ? t.mixedQuota
        : item.quotaMb === 0
          ? t.unlimitedQuota
          : item.quotaMb >= 1024
            ? `${Number((item.quotaMb / 1024).toFixed(2))} GB`
            : `${item.quotaMb} MB`;
  const renewCents = item.renewPriceCents || item.priceCents;
  return (
    <dl className="border-t border-border pt-5 text-sm/body">
      <Row label={t.count}>
        {seatRange ? t.seatCountValue(seatRange.min, seatRange.max) : t.quantity(item.mailboxCount)}
      </Row>
      <Row label={t.quota}>{quota}</Row>
      {item.periodDays !== undefined && !item.trial && (
        <Row label={t.period}>
          <>
            {item.periodDays > 0 ? (
              <>
                {t.periodValue(item.periodDays)}
                {usdt ? (
                  <>
                    <br />
                    {t.usdtPrice(formatUsdt(renewCents), item.periodDays)}
                  </>
                ) : stripeCurrency !== undefined ? (
                  stripeCurrency && (
                    <>
                      <br />
                      {t.cardPrice(formatMoney(renewCents, stripeCurrency, lang), item.periodDays)}
                    </>
                  )
                ) : renewCents !== item.priceCents ? (
                  // The price above already reads "per period"; only spell out a renewal price that differs from it.
                  <>
                    <br />
                    {seatRange ? t.seatRenewAt(formatCredits(renewCents)) : t.renewAt(formatCredits(renewCents))}
                  </>
                ) : null}
              </>
            ) : (
              t.oneTime
            )}
          </>
        </Row>
      )}
      <Row label={t.expiry}>{item.codeExpiresDays ? t.days(item.codeExpiresDays) : t.unlimited}</Row>
      {item.customDomains ? <Row label={t.ownDomains}>{t.ownDomainsValue(item.customDomains)}</Row> : null}
      <div>
        <dt className="text-muted-foreground">{t.domains}</dt>
        <dd className="mt-2.5 flex flex-wrap gap-2 wrap-anywhere">
          {item.domains.map((domain) => (
            <Badge
              className="h-auto w-auto shrink border-0 py-1 text-xs/body font-normal whitespace-normal text-foreground"
              key={domain}
            >
              @{domain}
            </Badge>
          ))}
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5 flex justify-between gap-3.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
