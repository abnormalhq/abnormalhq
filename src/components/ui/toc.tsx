"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Which section the reader is in: the last one whose heading has passed `offset` pixels from the top of the viewport.
 * Before the first heading nothing is current; at the very bottom of the page the last section is, so a short closing
 * section can be reached even when its heading never scrolls that far up.
 */
function currentSection(headingTops: readonly number[], offset: number, atBottom: boolean) {
  if (headingTops.length === 0) return -1;
  if (atBottom) return headingTops.length - 1;
  let current = -1;
  headingTops.forEach((top, index) => {
    if (top <= offset) current = index;
  });
  return current;
}

/**
 * The table of contents beside a long document: a navigation landmark of links to its sections, named by `label`
 * ("On this page"), that marks the section being read with aria-current="location" as the page scrolls.
 * The list is markup, so it renders on the server and works without JavaScript; the script only adds the mark. It
 * reads the links' own targets (`href="#id"`) and counts a heading as reached once it is where following its link
 * puts it: below the page's scroll-padding-top and the heading's own scroll-margin-top, so a sticky header is
 * accounted for, plus `offset` pixels of slack. A link whose target is missing turns the mark off. The links are read
 * again as the list changes, so a Toc that stays mounted while the page shows another document follows the new one.
 * `onCurrentChange` hears the section id as it changes, for a page that shows it elsewhere too.
 */
function Toc({
  label,
  offset = 32,
  onCurrentChange,
  className,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & {
  /** The landmark's name, such as "On this page". */
  label: string;
  /** How far below its resting place a heading still counts as reached, in pixels. */
  offset?: number;
  onCurrentChange?: (id: string | null) => void;
}) {
  const root = React.useRef<HTMLElement>(null);
  const report = React.useRef(onCurrentChange);
  React.useEffect(() => {
    report.current = onCurrentChange;
  });

  React.useEffect(() => {
    const nav = root.current;
    if (!nav) return;
    let frame = 0;
    let marked: HTMLAnchorElement | null = null;
    let reported: string | null | undefined;
    const mark = (link: HTMLAnchorElement | null, id: string | null) => {
      if (link !== marked) {
        marked?.removeAttribute("aria-current");
        link?.setAttribute("aria-current", "location");
        marked = link;
      }
      if (id !== reported) {
        reported = id;
        report.current?.(id);
      }
    };
    // The links and their headings are read again on every update, so the table of contents of another document,
    // rendered into the same Toc, is followed instead of the links it replaced.
    const update = () => {
      frame = 0;
      const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
      const targets = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))));
      if (links.length === 0 || targets.some((target) => !target)) return mark(null, null);
      const page = document.documentElement;
      const padding = parseFloat(getComputedStyle(page).scrollPaddingTop) || 0;
      const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= page.scrollHeight - 2;
      const index = currentSection(
        targets.map(
          (target) =>
            target!.getBoundingClientRect().top - (parseFloat(getComputedStyle(target!).scrollMarginTop) || 0),
        ),
        padding + offset,
        atBottom,
      );
      mark(links[index] ?? null, index === -1 ? null : targets[index]!.id);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // New links, or links pointing elsewhere: the list changed under the same Toc. Its own mark is not watched.
    const changed = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(schedule);
    changed?.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      changed?.disconnect();
      marked?.removeAttribute("aria-current");
    };
  }, [offset]);

  return <nav ref={root} data-slot="toc" aria-label={label} className={cn("text-sm", className)} {...props} />;
}

/** The visible heading of the table of contents, such as "On this page"; the landmark keeps its own `label`. */
function TocTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="toc-title" className={cn("mb-3 font-medium text-foreground", className)} {...props} />;
}

/** The sections, in order, on a hairline that the current one's mark sits on. */
function TocList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol data-slot="toc-list" className={cn("flex flex-col border-l border-border", className)} {...props} />;
}

/**
 * One section: a link to its heading (`href="#id"`) in a list item. The current one is marked by a 2px bar in the
 * signal color over the list's hairline, as in vertical Tabs. `level` indents a subsection.
 */
function TocLink({
  level = 1,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  /** 1 for a section, 2 and 3 for the ones inside it. */
  level?: 1 | 2 | 3;
}) {
  return (
    <li data-slot="toc-item" data-level={level} className="flex">
      <a
        data-slot="toc-link"
        className={cn(
          "-ml-px block min-w-0 flex-1 border-l-2 border-transparent py-1.5 pr-2 text-muted-foreground transition-colors duration-100 hover:text-foreground focus-visible:-outline-offset-2 aria-[current=location]:border-signal aria-[current=location]:font-medium aria-[current=location]:text-foreground",
          level === 1 ? "pl-3" : level === 2 ? "pl-6" : "pl-9",
          className,
        )}
        {...props}
      />
    </li>
  );
}

export { Toc, TocTitle, TocList, TocLink };
