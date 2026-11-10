"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { planViews } from "@/lib/pricing";
import { sharedCatalog } from "@/storefront/lib/catalog-shared";
import type { ShopCatalog } from "@/storefront/lib/catalog";
import { Icon } from "./Icon";
import { PlanCards, PlanNotice, type PlanCopy } from "./PlanCards";

export type HomePricingCopy = PlanCopy &
  Pick<
    Copy["pricing"],
    "loading" | "closedTitle" | "closedBody" | "errorTitle" | "errorBody" | "retry" | "shopLink" | "priceNote"
  >;

/**
 * The plans in the home page's pricing section. The home page is prerendered at build time and prices must never be the build's, so
 * this reads the catalog in the browser, the way the shop page does; the pricing page (/pricing/) renders the same cards on the server.
 * Copy comes in through props, so the bundle carries one language's pricing wording and nothing else of the copy.
 */
export function HomePricing({ lang, copy, shop }: { lang: Lang; copy: HomePricingCopy; shop: string }) {
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
        {copy.shopLink} <Icon name="up-right" className="size-4" />
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
          </>
        }
      >
        {copy.errorBody}
      </PlanNotice>
    );
  }
  if (!catalog) return <PlanNotice role="status">{copy.loading}</PlanNotice>;
  const plans = planViews(catalog, lang, copy, shop);
  if (plans.length === 0) return <PlanNotice title={copy.closedTitle}>{copy.closedBody}</PlanNotice>;
  return (
    <>
      <PlanCards plans={plans} copy={copy} />
      <p className="mt-6 max-w-3xl text-xs/[1.9] text-muted-foreground">{copy.priceNote}</p>
    </>
  );
}
