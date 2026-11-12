import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
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
}: {
  plans: readonly PlanView[];
  copy: PlanCopy;
  /** The cards' heading level: h3 under the home section's h2, h2 under the pricing page's h1. */
  heading?: "h2" | "h3";
}) {
  const Heading = heading;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-4">
      {plans.map((plan, index) => (
        <Card
          asChild
          variant={index === 0 ? "featured" : "interactive"}
          className="row-span-5 grid grid-rows-subgrid gap-y-0 px-[1.4rem] pt-6 pb-[1.4rem] max-sm:p-6"
          key={plan.id}
        >
          <article>
            <div>
              <IconTile variant={index === 0 ? "highlight" : "default"} aria-hidden="true">
                <Icon name="mail" className="size-[22px]" />
              </IconTile>
              <Heading className="mt-6 text-xl/[1.4] wrap-anywhere">{plan.name}</Heading>
              {plan.description && (
                <p className="mt-[0.6rem] text-base/prose whitespace-pre-line wrap-anywhere text-muted-foreground">
                  {plan.description}
                </p>
              )}
            </div>
            <div className="flex flex-col pt-6">
              <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <strong className="text-[2.5rem] leading-[1.1] font-semibold tracking-[-0.03em]">{plan.amount}</strong>
                <span className="text-xs/body text-muted-foreground">{plan.unit}</span>
              </p>
              {plan.discount && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs/body text-muted-foreground">
                  <Badge variant="brand" className="h-auto border-0 py-[3px] text-xs/body font-semibold">
                    {plan.discount.label}
                  </Badge>
                  <span>
                    <span className="sr-only">{copy.plan.originalPrice} </span>
                    <s>{plan.discount.original}</s>
                  </span>
                </p>
              )}
              {plan.card && <p className="mt-auto pt-3 text-sm/body text-muted-foreground">{plan.card}</p>}
              {plan.note && <p className="pt-3 text-xs/[1.7] text-muted-foreground">{plan.note}</p>}
            </div>
            <dl className="mt-6 border-t border-border pt-5 text-sm/body">
              {cardRows
                // "Your own domain" is listed on the plans that include it; the table says which do not.
                .filter((row) => row !== "ownDomains" || plan.customDomains > 0)
                .map((row) => (
                  <Fact label={copy.compare.rows[row]} key={row}>
                    {plan.rows[row]}
                  </Fact>
                ))}
            </dl>
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5 flex justify-between gap-3.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/**
 * The same values side by side: one column per plan, one row per fact. The table scrolls sideways inside its own frame on narrow
 * screens, and the frame is focusable so a keyboard can scroll it.
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
  const cell = "border-b border-border px-5 py-3.5 text-left align-top";
  // The row labels stay put while the plans scroll sideways on a narrow screen, so every value keeps its label in view.
  // They need a background of their own to cover the cells sliding under them, and a hairline on the right to show the edge.
  const labelCell =
    "sticky left-0 z-1 bg-background shadow-[inset_-1px_0_0_var(--border)] max-sm:w-[8.5rem] max-sm:px-4 md:shadow-none";
  const rows = planRowsFor(plans);
  return (
    <div
      // relative: the cells' sr-only text is absolutely positioned, and without a positioned frame it escapes the scroll clip
      // and makes the whole page scroll sideways on a phone.
      className="relative overflow-x-auto rounded-panel border border-border focus-visible:outline-2 focus-visible:outline-ring"
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm/body" aria-labelledby={labelledBy}>
        <thead>
          <tr>
            <th scope="col" className={cn(cell, labelCell, "w-[11rem] font-normal text-muted-foreground")}>
              {copy.compare.feature}
            </th>
            {plans.map((plan) => (
              <th scope="col" className={cn(cell, "text-base font-semibold wrap-anywhere")} key={plan.id}>
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row}>
              <th
                scope="row"
                className={cn(
                  cell,
                  labelCell,
                  "font-normal text-muted-foreground",
                  index === rows.length - 1 && "border-b-0",
                )}
              >
                {copy.compare.rows[row]}
              </th>
              {plans.map((plan) => (
                <td className={cn(cell, "wrap-anywhere", index === rows.length - 1 && "border-b-0")} key={plan.id}>
                  {plan.rows[row]}
                  {row === "price" && plan.discount && (
                    <span className="mt-1 block text-xs/body text-muted-foreground">
                      {plan.discount.label} · <span className="sr-only">{copy.plan.originalPrice} </span>
                      <s>{plan.discount.original}</s>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The panel shown instead of plans: loading, shop closed, or catalog unreadable. */
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
    <Card className="block px-7 py-12 text-center" role={role}>
      {title && <p className="text-xl/[1.4] font-semibold">{title}</p>}
      <p className={cn("mx-auto max-w-xl text-base/prose text-muted-foreground", title && "mt-2.5")}>{children}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </Card>
  );
}
