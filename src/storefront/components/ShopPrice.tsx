import { PricingPrice } from "@/components/ui/pricing-card";
import { cn } from "@/lib/utils";
import { useShopCopy } from "./copy/context";
import { formatCredits, type ShopProduct } from "@/storefront/lib/shop";

/**
 * A plan's or an order's LDC price: the registry's PricingPrice, the amount first and the discount on one line below it, so
 * amounts in neighbouring plan cards stay level whether or not a plan is discounted.
 */
export function ShopPrice({
  item,
  purchase = false,
  unit,
  className,
}: {
  item: Pick<ShopProduct, "originalPriceCents" | "discountPercent" | "priceCents" | "periodDays">;
  purchase?: boolean;
  /** What the amount is in, instead of the purchase unit: a seat plan's "LDC / mailbox / 30 days". */
  unit?: string;
  className?: string;
}) {
  const t = useShopCopy();
  const discounted = item.discountPercent > 0;
  return (
    <PricingPrice
      className={cn("my-[26px]", className)}
      price={formatCredits(item.priceCents)}
      period={unit ?? (purchase ? (item.periodDays ? t.perPeriod(item.periodDays) : t.once) : "LDC")}
      discount={discounted ? t.discount(item.discountPercent) : undefined}
      {...(discounted
        ? { originalPrice: `${formatCredits(item.originalPriceCents)} LDC`, originalPriceLabel: t.originalPrice }
        : { originalPrice: undefined })}
    />
  );
}
