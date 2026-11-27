"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProductTab = { value: string; label: string; badge?: string; content: ReactNode };

/**
 * The row of product tabs at the top of the home page, each tab swapping the headline and the stage under it. The
 * panels are rendered on the server and passed in, so this only holds which one is showing. Before hydration, and
 * without JavaScript, the first tab's panel is the page.
 */
export function ProductTabs({
  label,
  tabs,
  aside,
}: {
  label: string;
  tabs: readonly ProductTab[];
  /** Quiet metadata aligned at the right end of the section line (e.g. live service status). */
  aside?: ReactNode;
}) {
  return (
    <Tabs defaultValue={tabs[0]!.value} className="items-stretch gap-0">
      {/* Magazine section line: numbered product tabs on the left, live operational status quietly on the right. */}
      <div className="flex animate-rise flex-wrap items-center justify-between gap-4 border-b border-border">
        <TabsList aria-label={label} className="-mb-px border-b-0 data-[orientation=horizontal]:gap-7">
          {tabs.map((tab, index) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-2 px-0">
              <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
                0{index + 1}
              </span>
              <span lang="en">{tab.label}</span>
              {tab.badge && (
                <span className="rounded-chip bg-surface px-1.5 py-0.5 text-2xs font-normal text-muted-foreground">
                  {tab.badge}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {aside && <div className="pb-2 text-xs/body">{aside}</div>}
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="w-full focus-visible:outline-offset-8">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
