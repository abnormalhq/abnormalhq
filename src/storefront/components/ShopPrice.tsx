import { Badge } from "@/components/ui/badge";
import { PricingPrice } from "@/components/ui/pricing-card";
import { cn } from "@/lib/utils";
import { useShopCopy } from "./copy/hooks";
import { formatCredits, type ShopProduct } from "@/storefront/lib/shop";

/**
 * A plan's or an order's LDC price: the registry's PricingPrice, the amount first and the discount on one line below it, so
 * amounts in neighbouring plan cards stay level whether or not a plan is discounted.
 * Only the single highlighted plan uses the brand yellow discount chip; other discounted cards take calm sage so yellow stays once per screen.
 */
export function ShopPrice({
  item,
  purchase = false,
  unit,
  featured = false,
  className,
}: {
  item: Pick<ShopProduct, "originalPriceCents" | "discountPercent" | "priceCents" | "periodDays">;
  purchase?: boolean;
  /** What the amount is in, instead of the purchase unit: a seat plan's "LDC / mailbox / 30 days". */
  unit?: string;
  /** Whether this price carries the screen's single highlighter-yellow discount badge. */
  featured?: boolean;
  className?: string;
}) {
  const t = useShopCopy();
  const discounted = item.discountPercent > 0;
  const original = `${formatCredits(item.originalPriceCents)} LDC`;
  return (
    <div className={cn("my-6.5", className)}>
      <PricingPrice
        price={formatCredits(item.priceCents)}
        period={unit ?? (purchase ? (item.periodDays ? t.perPeriod(item.periodDays) : t.once) : "LDC")}
        discount={discounted && featured ? t.discount(item.discountPercent) : undefined}
        {...(discounted && featured
          ? { originalPrice: original, originalPriceLabel: t.originalPrice }
          : { originalPrice: undefined })}
      />
      {discounted && !featured && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs text-muted-foreground">
          <Badge className="bg-sage-soft font-semibold text-sage-ink">{t.discount(item.discountPercent)}</Badge>
          <span>
            <span className="sr-only">{t.originalPrice} </span>
            <s>{original}</s>
          </span>
        </p>
      )}
    </div>
  );
}
