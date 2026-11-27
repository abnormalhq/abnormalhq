"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { planViews } from "@/lib/pricing";
import { sharedCatalog, type ShopCatalog } from "@/storefront";
import { Icon } from "./Icon";
import { PlanNotice, type PlanCopy } from "./PlanCards";
import { PriceCalculator } from "./PriceCalculator";
import { TrialNote } from "./TrialNote";

export type HomePricingCopy = PlanCopy &
  Pick<
    Copy["pricing"],
    | "loading"
    | "closedTitle"
    | "closedBody"
    | "errorTitle"
    | "errorBody"
    | "retry"
    | "shopLink"
    | "priceNote"
    | "compareLink"
    | "calculator"
    | "trial"
  >;

/**
 * The price calculator in the home page's pricing section; the plan cards and their comparison are on the pricing page. The
 * home page is prerendered at build time and prices must never be the build's, so this reads the catalog in the browser, the
 * way the shop page does; the pricing page (/pricing/) renders the same calculator from the catalog it reads on the Worker.
 * Copy comes in through props, so the bundle carries one language's pricing wording and nothing else of the copy.
 */
export function HomePricing({
  lang,
  copy,
  shop,
  pricing,
  account,
}: {
  lang: Lang;
  copy: HomePricingCopy;
  shop: string;
  /** The buyer account page, where the free trial is claimed. */
  account: string;
  /** The full pricing page: shown while plans load, and as the no-JavaScript path. */
  pricing: string;
}) {
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    sharedCatalog(lang).then(
      (value) => current && setCatalog(value),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [attempt, lang]);

  const shopButton = (
    <Button asChild variant="outline" size="lg">
      <a href={shop}>
        {copy.shopLink} <Icon name="arrow" className="size-4" />
      </a>
    </Button>
  );

  const pricingLink = (
    <Button asChild variant="outline" size="lg">
      <a href={pricing}>
        {copy.compareLink} <Icon name="arrow" className="size-4" />
      </a>
    </Button>
  );

  if (failed) {
    return (
      <PlanNotice
        title={copy.errorTitle}
        role="alert"
        actions={
          <>
            <Button
              size="lg"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              {copy.retry}
            </Button>
            {shopButton}
            {pricingLink}
          </>
        }
      >
        {copy.errorBody}
      </PlanNotice>
    );
  }
  if (!catalog) {
    return (
      <PlanNotice
        role="status"
        actions={
          <>
            {pricingLink}
            {shopButton}
          </>
        }
      >
        {copy.loading}
      </PlanNotice>
    );
  }
  // The trial is its own offer: the shop shows it even when no paid plan is on sale, and so does this section.
  const trial = <TrialNote className="mt-8" trial={catalog.trial} copy={copy.trial} account={account} />;
  if (planViews(catalog, lang, copy, shop).length === 0)
    return (
      <>
        <PlanNotice title={copy.closedTitle}>{copy.closedBody}</PlanNotice>
        {trial}
      </>
    );
  return (
    <>
      <PriceCalculator catalog={catalog} lang={lang} copy={copy} shop={shop} />
      {trial}
      <p className="mt-6 max-w-3xl text-xs/[1.9] text-muted-foreground">{copy.priceNote}</p>
    </>
  );
}
