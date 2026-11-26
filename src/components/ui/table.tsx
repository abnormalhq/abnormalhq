"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { LabelTooltip } from "@/components/ui/tooltip";
import { usePointerFocus } from "@/components/ui/use-scroll-fade";

type TableVariant = "default" | "plain";
type TableDensity = "default" | "compact";

/** Table variants: `default` has a header background and row lines (tables inside panels such as the settings page); `plain` is the list style: no row lines, a light header, rounded hover rows. */
const TableVariantContext = React.createContext<TableVariant>("default");
/** `compact` rows are shorter and their cells closer, in the smaller text: a dense list beside a pane of facets or details. */
const TableDensityContext = React.createContext<TableDensity>("default");

/**
 * An easy-to-scan data table, keeping horizontal scrolling and clear row-selection feedback.
 * When there is content to the right of the container not yet revealed it carries `data-overflow="end"`, from which `pinned` columns draw a shadow separator on their left.
 * When the container has a limited height (ListSection on list pages) it is also the vertical scroll container: the plain header sticks to the top, and after scrolling down it carries `data-scrolled`, drawing a thin line under the header.
 * While the container scrolls either way it takes keyboard focus, so the arrow keys can scroll it in browsers that
 * do not focus a scroller by themselves (Safari); a table that fits adds no tab stop. Its focus ring is the keyboard's:
 * a click on a row focuses the container too, and draws no ring, even after a key such as J or Escape (usePointerFocus).
 * The ring is drawn over the visible part of the table, above the sticky header and the pinned columns, which would
 * cover an outline of the container itself. A focusable region needs a
 * name, and the words are the page's: name the table with `aria-label` or `aria-labelledby` and the container
 * becomes a region with the same name.
 * `density="compact"` makes the rows shorter and the cells closer, in the smaller text, for a dense list that sits
 * between side panes; every list of a product should use the same density.
 * The row helpers (`rowActionClassName`, `rowClickHandler`) are in table-row.ts: this module is "use client", so it exports components only.
 */
function Table({
  className,
  variant = "default",
  density = "default",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: React.ComponentProps<"table"> & { variant?: TableVariant; density?: TableDensity }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [scrollable, setScrollable] = React.useState(false);
  const named = ariaLabel !== undefined || ariaLabelledby !== undefined;
  usePointerFocus(containerRef);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      setOverflowing(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
      setScrolled(container.scrollTop > 0);
      setScrollable(
        container.scrollWidth > container.clientWidth + 1 || container.scrollHeight > container.clientHeight + 1,
      );
      // The focus ring covers the visible part of the table, which a scroller's children cannot size themselves to.
      container.style.setProperty("--table-viewport-height", `${container.clientHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    // The table itself, not the focus ring that comes before it while the container scrolls.
    const table = container.querySelector(":scope > table");
    if (table) observer.observe(table);
    container.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <TableVariantContext.Provider value={variant}>
      <TableDensityContext.Provider value={density}>
        <div
          ref={containerRef}
          data-slot="table-container"
          data-overflow={overflowing ? "end" : undefined}
          data-scrolled={scrolled || undefined}
          tabIndex={scrollable ? 0 : undefined}
          role={scrollable && named ? "region" : undefined}
          aria-label={scrollable ? ariaLabel : undefined}
          aria-labelledby={scrollable ? ariaLabelledby : undefined}
          // The container draws no outline of its own: the sticky header and pinned cells are painted over it. The ring
          // below takes its place.
          className="group/table relative min-h-0 w-full overflow-x-auto focus-visible:outline-none"
        >
          {scrollable && (
            // The focus ring of the container, laid over the part of the table in view: a block of no height before the
            // table that sticks to the visible top and start, holding a box as tall as the view, which also covers the
            // empty part of a box taller than its rows. It is drawn inside the edge (outside it, a panel that clips its
            // content would cut it off) and on top of the sticky header and pinned columns.
            <div
              aria-hidden="true"
              data-slot="table-focus-ring"
              className="pointer-events-none sticky start-0 top-0 z-[4] h-0"
            >
              <div className="absolute inset-x-0 top-0 hidden h-(--table-viewport-height) outline-2 -outline-offset-2 outline-(--focus) group-[:focus-visible:not([data-pointer-focus])]/table:block" />
            </div>
          )}
          <table
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
            data-slot="table"
            data-variant={variant}
            data-density={density}
            className={cn(
              "w-full caption-bottom text-base",
              variant === "plain" && "border-separate border-spacing-0",
              density === "compact" && "text-sm",
              className,
            )}
            {...props}
          />
        </div>
      </TableDensityContext.Provider>
    </TableVariantContext.Provider>
  );
}

/**
 * A column pinned to the right (usually "Actions"): always visible while scrolling horizontally.
 * A sticky cell must carry its own opaque background, so here the background is completed according to the header / row hover and selected states.
 */
const pinnedEnd =
  "sticky right-0 z-[1] in-data-[overflow=end]:shadow-[inset_1px_0_0_var(--border),-10px_0_12px_-10px_rgb(0_0_0/0.18)]";

/** Pinned column of a plain table: there are no row lines to connect to, so no separator is drawn; on overflow a fade in the page color is laid on the left so scrolled-past content fades out naturally. */
const pinnedPlain =
  "sticky right-0 z-[1] in-data-[overflow=end]:before:pointer-events-none in-data-[overflow=end]:before:absolute in-data-[overflow=end]:before:inset-y-0 in-data-[overflow=end]:before:-left-6 in-data-[overflow=end]:before:w-6 in-data-[overflow=end]:before:bg-linear-to-r in-data-[overflow=end]:before:from-transparent in-data-[overflow=end]:before:to-background [tr:hover>&]:before:hidden [tr:has([aria-expanded=true])>&]:before:hidden";

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  const variant = React.useContext(TableVariantContext);
  return (
    <thead
      data-slot="table-header"
      className={cn(
        variant === "plain" ? "[&_tr]:hover:bg-transparent" : "bg-muted/50 [&_tr]:border-b [&_tr]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

/**
 * A row. `current` marks the row a list's details pane shows, the one J and K move: it takes the selected tint and a
 * mark in the signal color at its start edge (ink in light, yellow in dark and in the ink shell, so it shows on the
 * tint), and `aria-current`. It is not selection (`data-state="selected"`, the checked rows).
 */
function TableRow({ className, current = false, ...props }: React.ComponentProps<"tr"> & { current?: boolean }) {
  const variant = React.useContext(TableVariantContext);
  return (
    <tr
      data-slot="table-row"
      data-current={current || undefined}
      aria-current={current || undefined}
      className={cn(
        "group/row data-flash:animate-flash",
        // plain: the row itself draws no background or row lines (the radius is drawn on the cells); for the hover / selected / menu-open backgrounds see TableCell.
        variant === "plain"
          ? ""
          : // A checked row keeps its tint under the pointer and while its menu is open, as the current row does.
            "border-b transition-colors duration-100 hover:bg-accent has-aria-expanded:bg-accent data-[state=selected]:bg-selected data-[state=selected]:hover:bg-selected data-[state=selected]:has-aria-expanded:bg-selected",
        current &&
          (variant === "plain"
            ? "[&>td]:bg-selected [&>td:first-child]:shadow-[inset_2px_0_0_var(--signal)]"
            : // The current row keeps its tint under the pointer and while its menu is open.
              "bg-selected shadow-[inset_2px_0_0_var(--signal)] hover:bg-selected has-aria-expanded:bg-selected"),
        props.onClick && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, pinned = false, ...props }: React.ComponentProps<"th"> & { pinned?: boolean }) {
  const plain = React.useContext(TableVariantContext) === "plain";
  const compact = React.useContext(TableDensityContext) === "compact";
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-left align-middle whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        compact ? "px-3" : "px-4",
        // The plain header sticks to the top of the table container (when the container has no height limit it does not scroll, so it is effectively not sticky); it needs its own background to cover the rows scrolled past.
        // Each sticky cell is its own stacking layer, so the next cell's background covers a focus outline that spills past this cell's edge (the select-all checkbox column has no right padding): the cell holding keyboard focus is raised above its siblings (to the pinned column's level, which comes later and so still stays on top).
        plain
          ? "sticky top-0 z-[2] h-8 bg-background text-xs font-normal in-data-scrolled:shadow-[inset_0_-1px_0_var(--border)] has-[:focus-visible]:z-[3]"
          : "h-9 text-sm font-medium",
        pinned &&
          (plain
            ? [pinnedPlain, "z-[3] bg-background"]
            : [pinnedEnd, "bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]"]),
        className,
      )}
      {...props}
    />
  );
}

/**
 * A column header that sorts the table by its column, when the sorting happens on the server: a link to the same
 * list sorted the other way, so it can be opened in a new tab, prefetched, and is read as a link. The cell carries
 * `aria-sort` from `direction` ("asc", "desc", or none for a column the list is not sorted by), and an arrow shows it,
 * with a faint double arrow on the other columns.
 * `href` is the list sorted by this column; pass asChild with the router's link instead, as the only child. `title`
 * says what the click does ("Sort descending"), in the page's words. `aside` sits in the cell beside the link, such
 * as a refresh button.
 */
function SortableHead({
  direction,
  href,
  title,
  asChild = false,
  aside,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TableHead>, "aria-sort" | "title"> & {
  /** How the list is sorted by this column now; leave it out for a column it is not sorted by. */
  direction?: "asc" | "desc" | null;
  /** The list sorted by this column, as the next click would sort it. */
  href?: string;
  /** What the click does, such as "Sort descending", shown in the theme's tooltip and read as the link's description. */
  title?: string;
  /** The child is the link itself, such as the router's, with the column's name in it. */
  asChild?: boolean;
  /** Beside the link in the same cell. */
  aside?: React.ReactNode;
}) {
  const active = direction === "asc" || direction === "desc";
  const Icon = !active ? ChevronsUpDownIcon : direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const Comp = asChild ? Slot.Root : "a";
  const link = (
    <Comp
      data-slot="sortable-head-link"
      data-active={active || undefined}
      href={asChild ? undefined : href}
      className="group/sort -mx-1.5 inline-flex h-6 items-center gap-1 rounded-control px-1.5 transition-colors duration-100 select-none hover:bg-accent hover:text-foreground data-active:text-foreground"
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <Icon
        aria-hidden="true"
        className="size-3 shrink-0 opacity-40 transition-opacity group-hover/sort:opacity-100 group-data-active/sort:opacity-100"
      />
    </Comp>
  );
  const hinted = <LabelTooltip label={title}>{link}</LabelTooltip>;
  return (
    <TableHead aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"} {...props}>
      {aside === undefined ? (
        hinted
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {hinted}
          {aside}
        </span>
      )}
    </TableHead>
  );
}

/** Cell background of a plain table: hover, menu-open and selected are all drawn on the cells (a current or checked row keeps its tint under the pointer and while its menu is open), with the first and last cells rounded so together they form one rounded row; rows such as empty states carry `data-static` and do not respond to hover. */
const plainCell =
  "transition-colors duration-100 first:rounded-l-control last:rounded-r-control [tr:not([data-static]):not([data-current]):not([data-state=selected]):hover>&]:bg-accent [tr:not([data-current]):not([data-state=selected]):has([aria-expanded=true])>&]:bg-accent [tr[data-state=selected]>&]:bg-selected";

function TableCell({ className, pinned = false, ...props }: React.ComponentProps<"td"> & { pinned?: boolean }) {
  const plain = React.useContext(TableVariantContext) === "plain";
  const compact = React.useContext(TableDensityContext) === "compact";
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        compact ? "px-3 py-1.5" : "px-4 py-2",
        plain && plainCell,
        pinned &&
          plain && [
            pinnedPlain,
            "bg-background [tr:not([data-current]):not([data-state=selected]):has([aria-expanded=true])>&]:bg-accent [tr:not([data-static]):not([data-current]):not([data-state=selected]):hover>&]:bg-accent [tr[data-current]>&]:bg-selected [tr[data-state=selected]>&]:bg-selected",
          ],
        pinned &&
          !plain && [
            pinnedEnd,
            // When Chrome draws collapsed borders, a sticky cell's background covers the row's bottom border (every other row loses its line): the pinned column patches one in with an inset shadow, and the last row draws none.
            "shadow-[inset_0_-1px_0_var(--border)] [tr:last-child>&]:shadow-none",
            "in-data-[overflow=end]:shadow-[inset_1px_0_0_var(--border),inset_0_-1px_0_var(--border),-10px_0_12px_-10px_rgb(0_0_0/0.18)]",
            "in-data-[overflow=end]:[tr:last-child>&]:shadow-[inset_1px_0_0_var(--border),-10px_0_12px_-10px_rgb(0_0_0/0.18)]",
            "bg-card transition-colors duration-100 [tr:not([data-current]):not([data-state=selected]):has([aria-expanded=true])>&]:bg-accent [tr:not([data-current]):not([data-state=selected]):hover>&]:bg-accent [tr[data-current]>&]:bg-selected [tr[data-state=selected]>&]:bg-selected",
          ],
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption data-slot="table-caption" className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, SortableHead, TableRow, TableCell, TableCaption };
