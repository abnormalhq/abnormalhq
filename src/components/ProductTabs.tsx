"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProductTab = { value: string; label: string; badge?: string; content: ReactNode };

/**
 * The row of product tabs at the top of the home page, each tab swapping the headline and the stage under it. The
 * panels are rendered on the server and passed in, so this only holds which one is showing. Before hydration, and
 * without JavaScript, the first tab's panel is the page.
 */
export function ProductTabs({ label, tabs }: { label: string; tabs: readonly ProductTab[] }) {
  return (
    <Tabs defaultValue={tabs[0]!.value} className="items-start gap-0">
      {/* Plain underlined words above the headline, like the section line of a magazine cover, not a pill switch. */}
      <TabsList aria-label={label} className="animate-rise gap-6">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="px-0">
            <span lang="en">{tab.label}</span>
            {tab.badge && <span className="text-xs font-normal">· {tab.badge}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="w-full focus-visible:outline-offset-8">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
