"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Copy } from "@/i18n/types";
import { matchesQuery, type HelpSearchEntry } from "@/lib/help-search";
import { fillTemplate } from "@/lib/template";
import { Icon } from "./Icon";

export interface HelpSearchGroup {
  title: string;
  entries: readonly HelpSearchEntry[];
}

/**
 * The help center's article list with search-as-you-type. The prerendered page lists every article by topic, so it works
 * before hydration and without JavaScript; typing narrows the list in the browser (src/lib/help-search.ts: title, summary
 * and keywords, no request and no dependency). The number of matches is announced through a status region, and a topic
 * with no match is left out together with its heading.
 */
export function HelpSearch({ copy, groups }: { copy: Copy["help"]["search"]; groups: readonly HelpSearchGroup[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const visible = groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => matchesQuery(entry, query)) }))
    .filter((group) => group.entries.length > 0);
  const count = visible.reduce((sum, group) => sum + group.entries.length, 0);
  const searching = query.trim() !== "";

  return (
    <>
      <search>
        {/* Nothing to submit: the list below is the result. Enter must not reload the page. */}
        <form role="search" className="max-w-[36rem]" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor={`${id}-query`}>
            {copy.label}
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              size="lg"
              className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
              id={`${id}-query`}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-controls={`${id}-results`}
            />
            {searching && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 border-0"
                type="button"
                aria-label={copy.clear}
                title={copy.clear}
                onClick={() => setQuery("")}
              >
                <Icon name="close" className="size-4" />
              </Button>
            )}
          </div>
        </form>
      </search>
      <p className="mt-3 min-h-[1.6em] text-sm/[1.6] text-muted-foreground" role="status">
        {searching &&
          (count === 0
            ? copy.empty
            : count === 1
              ? copy.resultsOne
              : fillTemplate(copy.results, { count: String(count) }).join(""))}
      </p>
      <div className="mt-8 grid gap-12 md:mt-10" id={`${id}-results`}>
        {visible.map((group) => (
          <section aria-labelledby={`${id}-${group.title}`} key={group.title}>
            <h2 className="text-xl/[1.4] font-semibold" id={`${id}-${group.title}`}>
              {group.title}
            </h2>
            <ul className="mt-4 grid border-t border-border md:grid-cols-2 md:gap-x-10">
              {group.entries.map((entry) => (
                <li className="border-b border-border" key={entry.href}>
                  <Link
                    className="group/entry flex h-full items-start gap-4 py-5 transition-colors duration-150"
                    href={entry.href}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-md/[1.5] font-medium underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 group-hover/entry:decoration-current">
                        {entry.title}
                      </span>
                      <span className="mt-1.5 block text-base/prose text-muted-foreground">{entry.summary}</span>
                    </span>
                    <Icon
                      name="arrow"
                      className="mt-1 size-4 text-muted-foreground transition-colors duration-150 group-hover/entry:text-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
