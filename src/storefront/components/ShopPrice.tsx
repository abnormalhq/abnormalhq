import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Lang } from "@/storefront/i18n";
import { shopCopy } from "@/storefront/lib/shop-copy";
import { formatCredits, type ShopProduct } from "@/storefront/lib/shop";
import { shopPriceAmountClass, shopPriceLineClass, shopPriceUnitClass } from "./ShopParts";

/**
 * The amount comes first and the discount sits on one line below it, so amounts in neighbouring plan cards stay level
 * whether or not a plan is discounted.
 */
export function ShopPrice({
  item,
  lang,
  purchase = false,
  className,
}: {
  item: Pick<ShopProduct, "originalPriceCents" | "discountPercent" | "priceCents" | "periodDays">;
  lang: Lang;
  purchase?: boolean;
  className?: string;
}) {
  const t = shopCopy[lang];
  const discounted = item.discountPercent > 0;
  return (
    <div className={cn("my-[26px]", className)}>
      <p className={shopPriceLineClass}>
        <strong className={shopPriceAmountClass}>{formatCredits(item.priceCents)}</strong>
        <span className={shopPriceUnitClass}>
          {purchase ? (item.periodDays ? t.perPeriod(item.periodDays) : t.once) : "LDC"}
        </span>
      </p>
      {discounted ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs/body text-muted-foreground">
          <Badge variant="brand" className="h-auto border-0 py-[3px] text-xs/body font-semibold">
            {t.discount(item.discountPercent)}
          </Badge>
          <span>
            <span className="sr-only">{t.originalPrice} </span>
            <s>{formatCredits(item.originalPriceCents)} LDC</s>
          </span>
        </p>
      ) : null}
    </div>
  );
}
