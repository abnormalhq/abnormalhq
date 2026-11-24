import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Copy } from "@/i18n/types";
import { trialText } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { ShopCatalog } from "@/storefront";
import { Icon } from "./Icon";

/**
 * The free trial, offered next to the prices. Whether there is a trial, how long it lasts and how big its mailbox is all come from
 * the shop's catalog, so the strip appears only while the shop offers one and never states terms the shop does not. It has no state,
 * so the pricing page renders it on the server and the home page's pricing section in the browser.
 */
export function TrialNote({
  trial,
  copy,
  account,
  className,
}: {
  trial: ShopCatalog["trial"];
  copy: Copy["pricing"]["trial"];
  /** The buyer account page, where a signed-in buyer claims the trial. */
  account: string;
  className?: string;
}) {
  const text = trialText(trial, copy);
  if (!text) return null;
  return (
    <Card className={cn("flex-row flex-wrap items-center justify-between gap-x-8 gap-y-4 p-6 max-md:px-5", className)}>
      <div className="max-w-160 min-w-0 flex-[1_1_320px]">
        <p className="text-lg leading-[1.4] font-semibold tracking-title">{text.title}</p>
        <p className="mt-1.5 text-base/prose text-muted-foreground">{text.body}</p>
      </div>
      <Button asChild variant="outline" size="lg" className="shrink-0 max-md:w-full">
        <a href={account}>
          {copy.action} <Icon name="arrow" className="size-4" />
        </a>
      </Button>
    </Card>
  );
}
