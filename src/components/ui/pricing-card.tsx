import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Marker } from "@/components/ui/marker";

/**
 * One plan on a pricing page: its name, its price and period, what it includes, and the button that starts it.
 * Cards in a row line up: the feature list takes the spare height, so every call to action sits on the same line
 * whatever the number of features.
 * `featured` is for the one plan the page recommends. Its border is the deepened one of a featured Card and its
 * price takes the Marker, the highlighter stroke, which the brand allows once on a screen, so feature one plan, not
 * two. `badge` adds a word for it ("Most popular") as a highlighter chip beside the name.
 * `price` is text the page has already formatted ("$12", "Free", "12 €"): currency and number format belong to the
 * page's locale. `period` is the unit after it ("per mailbox / month"). The name is an h3 unless `heading` names
 * another level. Children are the feature list, and `action` the call to action, usually a Button.
 * A discounted plan gives `discount`, the offer in words ("20% off"), and `originalPrice`, the price before it, which
 * shows struck through on a line under the price, so prices in neighbouring cards stay level whether or not a plan is
 * discounted. `originalPriceLabel` ("Original price") goes before it for a screen reader, which does not read a
 * strike-through. `icon` goes above the name, such as an IconTile for the plan.
 * The price, with its period and offer, is PricingPrice, which the card renders and a page can render alone.
 */
/** The struck price comes with the words a screen reader says before it, which it cannot see struck. */
type OriginalPrice =
  | { originalPrice?: undefined; originalPriceLabel?: string }
  | {
      /** The price before the discount, formatted like `price`, shown struck through. */
      originalPrice: React.ReactNode;
      /** Read before the struck price by a screen reader: "Original price". */
      originalPriceLabel: string;
    };

/**
 * A price on its own, as PricingCard shows it: the amount in the heading face, the unit or period after it, and under
 * it the offer and the struck price before it. For the price outside a card: a shop's product page, an order panel, a
 * cell of a comparison table (`size="sm"`). It renders on the server. `highlight` takes the Marker, as a featured card
 * does, so give it to one price on a screen at most. Its parts keep the card's slot names (`pricing-card-price`,
 * `pricing-card-discount`), so a style written for the card's price applies wherever it is.
 */
function PricingPrice({
  price,
  period,
  discount,
  originalPrice,
  originalPriceLabel,
  highlight = false,
  size = "default",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** The price, already formatted for the page's locale: "$12", "Free", "12 €". */
  price: React.ReactNode;
  /** The unit after it: "per mailbox / month". */
  period?: React.ReactNode;
  /** The offer, as a highlighter chip under the price: "20% off". */
  discount?: React.ReactNode;
  /** The highlighter stroke under the amount. */
  highlight?: boolean;
  /** `sm` for a dense place such as a table cell. */
  size?: "default" | "sm";
} & OriginalPrice) {
  return (
    <div
      data-slot="pricing-price"
      data-size={size}
      className={cn("grid gap-3", size === "sm" && "gap-1.5", className)}
      {...props}
    >
      <p data-slot="pricing-card-price" className="flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            "font-heading leading-none font-semibold tracking-[-0.03em]",
            size === "sm" ? "text-xl" : "text-display-sm",
          )}
        >
          {highlight ? <Marker>{price}</Marker> : price}
        </span>
        {period !== undefined && <span className="text-sm text-muted-foreground">{period}</span>}
      </p>
      {(discount !== undefined || originalPrice !== undefined) && (
        <p
          data-slot="pricing-card-discount"
          className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs text-muted-foreground"
        >
          {discount !== undefined && (
            <Badge variant="brand" className="font-semibold">
              {discount}
            </Badge>
          )}
          {originalPrice !== undefined && (
            <span>
              <span className="sr-only">{originalPriceLabel} </span>
              <s>{originalPrice}</s>
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  badge,
  icon,
  action,
  discount,
  originalPrice,
  originalPriceLabel,
  featured = false,
  heading: Heading = "h3",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "variant" | "asChild"> & {
  name: React.ReactNode;
  price: React.ReactNode;
  period?: React.ReactNode;
  /** A line under the name: who the plan is for. */
  description?: React.ReactNode;
  /** A word for the featured plan, such as "Most popular". */
  badge?: React.ReactNode;
  /** Above the name, such as an IconTile. */
  icon?: React.ReactNode;
  /** The call to action. */
  action?: React.ReactNode;
  /** The offer, as a highlighter chip under the price: "20% off". */
  discount?: React.ReactNode;
  featured?: boolean;
  heading?: "h2" | "h3" | "h4";
} & OriginalPrice) {
  return (
    <Card
      data-slot="pricing-card"
      data-featured={featured || undefined}
      variant={featured ? "featured" : "default"}
      className={cn("gap-5 p-5", className)}
      {...props}
    >
      <div data-slot="pricing-card-header" className="grid gap-1">
        {icon !== undefined && icon !== null && (
          <div data-slot="pricing-card-icon" className="mb-2 flex">
            {icon}
          </div>
        )}
        <div className="flex min-h-6 items-center justify-between gap-2">
          <Heading data-slot="pricing-card-name" className="text-lg font-semibold">
            {name}
          </Heading>
          {badge !== undefined && <Badge variant="brand">{badge}</Badge>}
        </div>
        {description !== undefined && (
          <p data-slot="pricing-card-description" className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <PricingPrice
        price={price}
        period={period}
        discount={discount}
        // The two variants of the struck price travel together.
        {...(originalPrice === undefined
          ? { originalPriceLabel }
          : { originalPrice, originalPriceLabel: originalPriceLabel as string })}
        highlight={featured}
      />
      <div data-slot="pricing-card-features" className="flex-1">
        {children}
      </div>
      {action !== undefined && (
        <div data-slot="pricing-card-action" className="grid *:w-full">
          {action}
        </div>
      )}
    </Card>
  );
}

function PricingCardFeatures({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="pricing-card-feature-list" className={cn("grid gap-2.5 text-base", className)} {...props} />;
}

/** One thing the plan includes, led by a check. The check is decoration: the list already says these are included. */
function PricingCardFeature({ className, children, ...props }: React.ComponentProps<"li">) {
  return (
    <li data-slot="pricing-card-feature" className={cn("flex items-start gap-2.5", className)} {...props}>
      <span className="grid h-[1.5em] w-4 shrink-0 place-items-center" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-3.5 text-success"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export { PricingCard, PricingCardFeatures, PricingCardFeature, PricingPrice };
