import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/storefront/i18n";
import { shopCopy } from "@/storefront/lib/shop-copy";
import type { ReactNode } from "react";
import { formatCredits, formatMoney, type ShopProduct } from "@/storefront/lib/shop";

export function ShopDetails({
  item,
  lang,
  stripeCurrency,
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
  >;
  lang: Lang;
  /** Stripe order: the renewal price is a fiat amount in this currency, not LDC. */
  stripeCurrency?: string;
}) {
  const t = shopCopy[lang];
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
  return (
    <dl className="flex-1 border-t border-border pt-5 text-sm/body">
      <Row label={t.count}>{t.quantity(item.mailboxCount)}</Row>
      <Row label={t.quota}>{quota}</Row>
      {item.periodDays !== undefined && (
        <Row label={t.period}>
          <>
            {item.periodDays > 0 ? (
              <>
                {t.periodValue(item.periodDays)}
                <br />
                {stripeCurrency
                  ? t.cardPrice(
                      formatMoney(item.renewPriceCents || item.priceCents, stripeCurrency, lang),
                      item.periodDays,
                    )
                  : t.renewAt(formatCredits(item.renewPriceCents || item.priceCents))}
              </>
            ) : (
              t.oneTime
            )}
          </>
        </Row>
      )}
      <Row label={t.expiry}>{item.codeExpiresDays ? t.days(item.codeExpiresDays) : t.unlimited}</Row>
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
