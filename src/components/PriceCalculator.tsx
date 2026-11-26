"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { calculatorOptions, calculatorRange } from "@/lib/calculator";
import { cn } from "@/lib/utils";
import type { ShopCatalog } from "@/storefront";
import { ShopSeatStepper } from "@/storefront/components/ShopSeatStepper";
import { fillTemplate } from "@/lib/template";
import { Icon } from "./Icon";

export type PriceCalculatorCopy = Pick<Copy["pricing"], "plan" | "compare" | "calculator">;

/**
 * "Pay for the mailboxes you need": a count, the plans that sell that many with each one's total, the chosen plan's total
 * large with what it comes with, and the way to the shop with the plan and count chosen. The arithmetic is
 * src/lib/calculator.ts; the page gives the catalog (the pricing page reads it on the Worker, the home page in the browser).
 * Nothing is shown when nothing is on sale: the page says so itself.
 */
export function PriceCalculator({
  catalog,
  lang,
  copy,
  shop,
  className,
}: {
  catalog: ShopCatalog;
  lang: Lang;
  copy: PriceCalculatorCopy;
  shop: string;
  className?: string;
}) {
  const id = useId();
  const c = copy.calculator;
  const range = calculatorRange(catalog);
  const [count, setCount] = useState(range?.min ?? 1);
  const [chosenId, setChosenId] = useState<string | null>(null);
  if (!range) return null;
  const options = calculatorOptions(catalog, count, lang, copy, shop);
  // The plan picked stays picked while it still fits the count; otherwise the first plan that fits.
  const chosen = options.find((option) => option.id === chosenId) ?? options[0];

  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-panel border border-border-strong bg-popover shadow-sheet lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]",
        className,
      )}
    >
      {/* Left: interactive configuration (quantity + matching plans). */}
      <div className="flex min-w-0 flex-col gap-7 p-6 md:p-8 lg:border-r lg:border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Label className="text-md/body font-semibold tracking-title" htmlFor={`${id}-count`}>
            {c.count}
          </Label>
          <ShopSeatStepper
            id={`${id}-count`}
            value={count}
            min={range.min}
            max={range.max}
            onChange={setCount}
            fewerLabel={c.fewer}
            moreLabel={c.more}
          />
        </div>

        {options.length > 0 ? (
          <div role="group" aria-labelledby={`${id}-plans`}>
            <p className="text-sm/body text-muted-foreground" id={`${id}-plans`}>
              {c.plans}
            </p>
            <ul className="mt-3 grid gap-2.5">
              {options.map((option) => {
                const selected = option.id === chosen?.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChosenId(option.id)}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-4 rounded-control border px-4 py-3 text-left text-sm/body transition-colors duration-150",
                        selected
                          ? "border-foreground bg-selected font-medium text-foreground"
                          : "border-input text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      <span className="min-w-0">{option.name}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {option.amount} {option.unit}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p
            className="rounded-mark border border-border bg-surface/60 px-4 py-3 text-sm/prose text-muted-foreground"
            role="status"
          >
            {fillTemplate(c.none, { count: String(count) }).join("")}
          </p>
        )}

        <p className="mt-auto text-xs/prose text-muted-foreground">{c.estimate}</p>
      </div>

      {/* Right: receipt-style ledger pairing the live total, included facts and primary checkout action without dead space. */}
      <div className="flex min-w-0 flex-col justify-between gap-6 border-t border-border bg-surface/65 p-6 md:p-8 lg:border-t-0">
        {chosen ? (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3 text-xs text-muted-foreground">
                <span>{c.summaryTitle}</span>
                <span className="min-w-0 truncate font-mono tabular-nums">
                  {chosen.name} × {count}
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs/body text-muted-foreground">{c.total}</p>
                {/* Read out when the count or the plan changes: the total is what the controls on the left are for. */}
                <p className="mt-2" role="status">
                  <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-serif text-[clamp(2.75rem,5vw,4rem)] leading-none font-normal tracking-heading lining-nums tabular-nums">
                      {chosen.amount}
                    </span>
                    <span className="text-sm/body text-muted-foreground">{chosen.unit}</span>
                    {chosen.original && (
                      <span className="font-mono text-xs text-muted-foreground">
                        <span className="sr-only">{copy.plan.originalPrice} </span>
                        <s>{chosen.original}</s>
                      </span>
                    )}
                  </span>
                </p>
                {chosen.card && <p className="mt-2.5 text-xs/prose text-muted-foreground">{chosen.card}</p>}
                {chosen.usdt && <p className="mt-1 text-xs/prose text-muted-foreground">{chosen.usdt}</p>}
                {chosen.renewal && <p className="mt-1 text-xs/prose text-muted-foreground">{chosen.renewal}</p>}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs/body font-medium text-muted-foreground">{c.includes}</p>
                <ul className="mt-3.5 grid gap-2.5 text-sm/prose">
                  {chosen.facts.map((fact) => (
                    <li className="flex items-start gap-2.5" key={fact}>
                      <Icon name="check" className="mt-1 size-4 shrink-0 text-sage" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-border pt-5">
              <Button asChild size="lg" className="w-full justify-between">
                <a href={chosen.href}>
                  {c.checkout} <Icon name="arrow" className="size-4" />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <div className="my-auto text-sm/prose text-muted-foreground">
            {fillTemplate(c.none, { count: String(count) }).join("")}
          </div>
        )}
      </div>
    </div>
  );
}
