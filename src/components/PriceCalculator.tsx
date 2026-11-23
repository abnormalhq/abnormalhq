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
        "grid overflow-hidden rounded-panel border border-border bg-control lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-7 p-6 md:p-9 lg:border-r lg:border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Label className="text-md/body font-medium" htmlFor={`${id}-count`}>
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

        {options.length > 1 && (
          <div role="group" aria-labelledby={`${id}-plans`}>
            <p className="text-sm/body text-muted-foreground" id={`${id}-plans`}>
              {c.plans}
            </p>
            <ul className="mt-3 grid gap-2">
              {options.map((option) => {
                const selected = option.id === chosen?.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChosenId(option.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-4 rounded-control border px-3.5 py-2.5 text-left text-sm/body transition-colors duration-150",
                        selected
                          ? "border-foreground bg-highlight-muted text-foreground"
                          : "border-input text-muted-foreground hover:border-foreground/40 hover:text-foreground",
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
        )}

        <div>
          <p className="text-sm/body text-muted-foreground">
            {c.total}
            {chosen && options.length === 1 && <> · {chosen.name}</>}
          </p>
          {/* Read out when the count or the plan changes: the total is what the controls above are for. */}
          <p className="mt-2" role="status">
            {chosen ? (
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-heading text-[clamp(3rem,6vw,4.5rem)] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {chosen.amount}
                </span>
                <span className="text-md/body text-muted-foreground">{chosen.unit}</span>
                {chosen.original && (
                  <span className="text-sm/body text-muted-foreground">
                    <span className="sr-only">{copy.plan.originalPrice} </span>
                    <s>{chosen.original}</s>
                  </span>
                )}
              </span>
            ) : (
              <span className="block max-w-[32rem] text-md/prose">
                {fillTemplate(c.none, { count: String(count) }).join("")}
              </span>
            )}
          </p>
          {chosen?.card && <p className="mt-3 text-sm/prose text-muted-foreground">{chosen.card}</p>}
          {chosen?.renewal && <p className="mt-1 text-sm/prose text-muted-foreground">{chosen.renewal}</p>}
        </div>

        {chosen && (
          <div className="flex flex-col items-start gap-3">
            <Button asChild size="lg" variant="highlight">
              <a href={chosen.href}>
                {c.checkout} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
            <p className="max-w-[34rem] text-xs/[1.8] text-muted-foreground">{c.estimate}</p>
          </div>
        )}
      </div>

      {chosen && (
        <div className="border-t border-border p-6 md:p-9 lg:border-t-0">
          <p className="text-sm/body font-medium">{c.includes}</p>
          <ul className="mt-4 grid gap-3 text-base/prose">
            {chosen.facts.map((fact) => (
              <li className="flex gap-3" key={fact}>
                <Icon name="check" className="mt-1 size-4 shrink-0 text-signal" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
