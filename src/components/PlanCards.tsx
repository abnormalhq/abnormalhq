import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateTitle } from "@/components/ui/empty-state";
import { PricingPrice } from "@/components/ui/pricing-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Copy } from "@/i18n/types";
import { planRows, planRowsFor, type PlanRow, type PlanView } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/** What the cards and the table need from the copy; the home page's client section passes exactly this through props. */
export type PlanCopy = Pick<Copy["pricing"], "plan" | "compare">;

/** The price and the card price sit in the card's price block; the rest are listed below it. */
const cardRows: readonly PlanRow[] = planRows.filter((row) => row !== "price" && row !== "card" && row !== "domains");

/**
 * The plans on sale, one card each, with what the catalog says about them (src/lib/pricing.ts). It has no state of its own, so the
 * pricing page renders it on the server and the home page's section in the browser.
 * Each card spans five rows of the shared grid (heading, price, details, domains, action) through subgrid, so prices, details and
 * buttons line up across a row of cards whatever the length of a description.
 */
export function PlanCards({
  plans,
  copy,
  heading = "h3",
  className,
}: {
  plans: readonly PlanView[];
  copy: PlanCopy;
  /** The cards' heading level: h3 under an h2 such as the pricing page's "Every plan". */
  heading?: "h2" | "h3";
  className?: string;
}) {
  const Heading = heading;
  return (
    <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-4", className)}>
      {plans.map((plan, index) => (
        <Card
          asChild
          variant={index === 0 ? "featured" : "interactive"}
          className="row-span-5 grid grid-rows-subgrid gap-y-0 px-[1.4rem] pt-6 pb-[1.4rem] max-sm:p-6"
          key={plan.id}
        >
          <article>
            <div>
              <Heading className="text-xl/[1.4] wrap-anywhere">{plan.name}</Heading>
              {plan.description && (
                <p className="mt-[0.6rem] text-base/prose whitespace-pre-line wrap-anywhere text-muted-foreground">
                  {plan.description}
                </p>
              )}
            </div>
            <div className="flex flex-col pt-6">
              <PricingPrice
                price={plan.amount}
                period={plan.unit}
                discount={plan.discount?.label}
                {...(plan.discount
                  ? { originalPrice: plan.discount.original, originalPriceLabel: copy.plan.originalPrice }
                  : { originalPrice: undefined })}
              />
              {plan.card && <p className="mt-auto pt-3 text-sm/body text-muted-foreground">{plan.card}</p>}
              {plan.note && <p className="pt-3 text-xs/[1.7] text-muted-foreground">{plan.note}</p>}
            </div>
            <DescriptionList variant="spread" className="mt-6 border-t border-border text-sm/body">
              {cardRows
                // "Your own domain" is listed on the plans that include it; the table says which do not.
                .filter((row) => row !== "ownDomains" || plan.customDomains > 0)
                .map((row) => (
                  <Fact label={copy.compare.rows[row]} key={row}>
                    {plan.rows[row]}
                  </Fact>
                ))}
            </DescriptionList>
            <div className="text-sm/body">
              <p className="text-muted-foreground">{copy.compare.rows.domains}</p>
              <ul className="mt-2.5 flex flex-wrap gap-2 wrap-anywhere">
                {plan.domains.map((domain) => (
                  <li key={domain}>
                    <Badge className="h-auto w-auto shrink border-0 py-1 text-xs/body font-normal whitespace-normal text-foreground">
                      @{domain}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-6">
              <Button
                asChild
                variant={index === 0 ? "default" : "outline"}
                size="lg"
                className="w-full justify-between"
              >
                <a href={plan.href} aria-label={plan.chooseLabel}>
                  {copy.plan.choose}
                  <Icon name="arrow" className="size-4" />
                </a>
              </Button>
            </div>
          </article>
        </Card>
      ))}
    </div>
  );
}

/** A fact of the plan: a receipt row whose value, when it wraps under its name, still keeps to the right. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DescriptionItem>
      <DescriptionTerm>{label}</DescriptionTerm>
      <DescriptionDetails className="ml-auto text-right">{children}</DescriptionDetails>
    </DescriptionItem>
  );
}

/**
 * The same values side by side: one column per plan, one row per fact. The registry's Table scrolls sideways inside its own
 * frame on narrow screens, and takes keyboard focus as a region named by the heading while it does.
 */
export function PlanComparison({
  plans,
  copy,
  labelledBy,
}: {
  plans: readonly PlanView[];
  copy: PlanCopy;
  /** id of the heading that names the table. */
  labelledBy: string;
}) {
  // Table's cells are dense and do not wrap; these keep the comparison's roomier cells, wrapping long values.
  const cell = "h-auto px-5 py-3.5 text-left align-top whitespace-normal";
  // The row labels stay put while the plans scroll sideways on a narrow screen, so every value keeps its label in view.
  // Table pins columns on the right only, so this one is pinned here: a background of its own to cover the cells sliding
  // under it, and a hairline on the right to show the edge.
  const labelCell =
    "sticky left-0 z-1 bg-background shadow-[inset_-1px_0_0_var(--border)] max-sm:w-34 max-sm:px-4 md:shadow-none";
  const rows = planRowsFor(plans);
  return (
    <div className="overflow-hidden rounded-panel border border-border">
      <Table className="min-w-136 text-sm/body" aria-labelledby={labelledBy}>
        {/* No header tint and no row hover: the comparison is read, not acted on, and the pinned labels keep one background. */}
        <TableHeader className="bg-transparent">
          <TableRow className="hover:bg-transparent">
            <TableHead
              scope="col"
              className={cn(cell, labelCell, "w-44 text-sm/body font-normal text-muted-foreground")}
            >
              {copy.compare.feature}
            </TableHead>
            {plans.map((plan) => (
              <TableHead
                scope="col"
                className={cn(cell, "text-base font-semibold wrap-anywhere text-foreground")}
                key={plan.id}
              >
                {plan.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow className="hover:bg-transparent" key={row}>
              <TableHead scope="row" className={cn(cell, labelCell, "text-sm/body font-normal text-muted-foreground")}>
                {copy.compare.rows[row]}
              </TableHead>
              {plans.map((plan) => (
                <TableCell className={cn(cell, "wrap-anywhere")} key={plan.id}>
                  {/* The LDC price as the cards write it, smaller; a plan without one says so in words. */}
                  {row === "price" && plan.rows.price !== copy.compare.none ? (
                    <PricingPrice
                      size="sm"
                      price={plan.amount}
                      period={plan.unit}
                      discount={plan.discount?.label}
                      {...(plan.discount
                        ? { originalPrice: plan.discount.original, originalPriceLabel: copy.plan.originalPrice }
                        : { originalPrice: undefined })}
                    />
                  ) : (
                    plan.rows[row]
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Shown instead of plans: loading, shop closed, or catalog unreadable. The registry's EmptyState, at the pricing page's size. */
export function PlanNotice({
  title,
  children,
  actions,
  role,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <EmptyState className="gap-0 bg-card px-7 py-12" role={role}>
      {title && <EmptyStateTitle className="text-xl/[1.4]">{title}</EmptyStateTitle>}
      <EmptyStateDescription className={cn("max-w-xl text-base/prose", title && "mt-2.5")}>
        {children}
      </EmptyStateDescription>
      {actions && <EmptyStateActions className="mt-6 gap-3">{actions}</EmptyStateActions>}
    </EmptyState>
  );
}
