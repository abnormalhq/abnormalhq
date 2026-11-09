import { Badge } from "@/components/ui/badge";
import type { Lang } from "@/storefront/i18n";
import { shopCopy } from "@/storefront/lib/shop-copy";
import { formatCredits, type ShopProduct } from "@/storefront/lib/shop";
import { shopPriceAmountClass, shopPriceLineClass, shopPriceUnitClass } from "./ShopParts";

export function ShopPrice({
  item,
  lang,
  purchase = false,
}: {
  item: Pick<ShopProduct, "originalPriceCents" | "discountPercent" | "priceCents" | "periodDays">;
  lang: Lang;
  purchase?: boolean;
}) {
  const t = shopCopy[lang];
  const discounted = item.discountPercent > 0;
  return (
    <div className="my-[26px]">
      {discounted ? (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs/body">
          <Badge variant="brand" className="h-auto border-0 py-[3px] text-xs/body font-semibold">
            {t.discount(item.discountPercent)}
          </Badge>
          <span className="text-muted-foreground">
            {t.originalPrice} <s>{formatCredits(item.originalPriceCents)} LDC</s>
          </span>
        </p>
      ) : null}
      <p className={shopPriceLineClass}>
        <strong className={shopPriceAmountClass}>{formatCredits(item.priceCents)}</strong>
        <span className={shopPriceUnitClass}>
          {purchase ? (item.periodDays ? t.perPeriod(item.periodDays) : t.once) : "LDC"}
        </span>
      </p>
      {discounted ? (
        <p className="mt-2.5 text-xs/body text-muted-foreground">
          {t.savings(formatCredits(item.originalPriceCents - item.priceCents))}
        </p>
      ) : null}
    </div>
  );
}
