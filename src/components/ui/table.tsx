"use client";

import * as React from "react";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

type TableVariant = "default" | "plain";

/** Table variants: `default` has a header background and row lines (tables inside panels such as the settings page); `plain` is the list style: no row lines, a light header, rounded hover rows. */
const TableVariantContext = React.createContext<TableVariant>("default");

/**
 * An easy-to-scan data table, keeping horizontal scrolling and clear row-selection feedback.
 * When there is content to the right of the container not yet revealed it carries `data-overflow="end"`, from which `pinned` columns draw a shadow separator on their left.
 * When the container has a limited height (ListSection on list pages) it is also the vertical scroll container: the plain header sticks to the top, and after scrolling down it carries `data-scrolled`, drawing a thin line under the header.
 * While the container scrolls either way it takes keyboard focus, so the arrow keys can scroll it in browsers that
 * do not focus a scroller by themselves (Safari); a table that fits adds no tab stop. A focusable region needs a
 * name, and the words are the page's: name the table with `aria-label` or `aria-labelledby` and the container
 * becomes a region with the same name.
 */
function Table({
  className,
  variant = "default",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: React.ComponentProps<"table"> & { variant?: TableVariant }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [scrollable, setScrollable] = React.useState(false);
  const named = ariaLabel !== undefined || ariaLabelledby !== undefined;

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      setOverflowing(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
      setScrolled(container.scrollTop > 0);
      setScrollable(
        container.scrollWidth > container.clientWidth + 1 || container.scrollHeight > container.clientHeight + 1,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (container.firstElementChild) observer.observe(container.firstElementChild);
    container.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <TableVariantContext.Provider value={variant}>
      <div
        ref={containerRef}
        data-slot="table-container"
        data-overflow={overflowing ? "end" : undefined}
        data-scrolled={scrolled || undefined}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable && named ? "region" : undefined}
        aria-label={scrollable ? ariaLabel : undefined}
        aria-labelledby={scrollable ? ariaLabelledby : undefined}
        // The focus ring is drawn inside the edge: outside it, a panel that clips its content would cut it off.
        className="relative min-h-0 w-full overflow-x-auto focus-visible:-outline-offset-2"
      >
        <table
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          data-slot="table"
          data-variant={variant}
          className={cn(
            "w-full caption-bottom text-base",
            variant === "plain" && "border-separate border-spacing-0",
            className,
          )}
          {...props}
        />
      </div>
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

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  const variant = React.useContext(TableVariantContext);
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row data-flash:animate-flash",
        // plain: the row itself draws no background or row lines (the radius is drawn on the cells); for the hover / selected / menu-open backgrounds see TableCell.
        variant === "plain"
          ? ""
          : "border-b transition-colors duration-100 hover:bg-accent has-aria-expanded:bg-accent data-[state=selected]:bg-highlight-muted",
        props.onClick && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, pinned = false, ...props }: React.ComponentProps<"th"> & { pinned?: boolean }) {
  const plain = React.useContext(TableVariantContext) === "plain";
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 text-left align-middle whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
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
  /** What the click does, such as "Sort descending". */
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
      title={title}
      className="group/sort -mx-1.5 inline-flex h-6 items-center gap-1 rounded-control px-1.5 transition-colors duration-150 select-none hover:bg-accent hover:text-foreground data-active:text-foreground"
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <Icon
        aria-hidden="true"
        className="size-3 shrink-0 opacity-40 transition-opacity group-hover/sort:opacity-100 group-data-active/sort:opacity-100"
      />
    </Comp>
  );
  return (
    <TableHead aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"} {...props}>
      {aside === undefined ? (
        link
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {link}
          {aside}
        </span>
      )}
    </TableHead>
  );
}

/** Cell background of a plain table: hover, menu-open and selected are all drawn on the cells, with the first and last cells rounded so together they form one rounded row; rows such as empty states carry `data-static` and do not respond to hover. */
const plainCell =
  "transition-colors duration-100 first:rounded-l-control last:rounded-r-control [tr:not([data-static]):hover>&]:bg-accent [tr:has([aria-expanded=true])>&]:bg-accent [tr[data-state=selected]>&]:bg-highlight-muted";

function TableCell({ className, pinned = false, ...props }: React.ComponentProps<"td"> & { pinned?: boolean }) {
  const plain = React.useContext(TableVariantContext) === "plain";
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        plain && plainCell,
        pinned &&
          plain && [
            pinnedPlain,
            "bg-background [tr:has([aria-expanded=true])>&]:bg-accent [tr:hover>&]:bg-accent [tr[data-state=selected]>&]:bg-highlight-muted",
          ],
        pinned &&
          !plain && [
            pinnedEnd,
            // When Chrome draws collapsed borders, a sticky cell's background covers the row's bottom border (every other row loses its line): the pinned column patches one in with an inset shadow, and the last row draws none.
            "shadow-[inset_0_-1px_0_var(--border)] [tr:last-child>&]:shadow-none",
            "in-data-[overflow=end]:shadow-[inset_1px_0_0_var(--border),inset_0_-1px_0_var(--border),-10px_0_12px_-10px_rgb(0_0_0/0.18)]",
            "in-data-[overflow=end]:[tr:last-child>&]:shadow-[inset_1px_0_0_var(--border),-10px_0_12px_-10px_rgb(0_0_0/0.18)]",
            "bg-card transition-colors duration-100 [tr:has([aria-expanded=true])>&]:bg-accent [tr:hover>&]:bg-accent [tr[data-state=selected]>&]:bg-highlight-muted",
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
