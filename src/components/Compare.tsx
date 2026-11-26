import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/ui/json-ld";
import { sectionSpaceClassName } from "@/components/ui/section-heading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { compareContent, compareRows, type CompareMark } from "@/content/compare";
import { site, type Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import type { IconName } from "@/i18n/types";
import { compareView, type CompareCell } from "@/lib/compare";
import { compareStructuredData } from "@/lib/structured-data";
import { fillTemplate } from "@/lib/template";
import { cn } from "@/lib/utils";
import type { ShopCatalog } from "@/storefront";
import { Icon } from "./Icon";
import { PageHeader } from "./PageHeader";

const markIcons: Record<Exclude<CompareMark, "partial">, IconName> = { yes: "check", no: "minus" };

/** A mark and its words. The icon is decoration; the mark is said in words for screen readers, before the cell's text. */
function MarkGlyph({ mark, label }: { mark: CompareMark; label: string }) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex size-4.5 shrink-0 items-center justify-center rounded-full",
        mark === "yes" && "bg-foreground text-background",
        // Half filled: the plan shown has part of it, or only a paid plan has it.
        mark === "partial" &&
          "border-[1.5px] border-foreground bg-[linear-gradient(90deg,var(--foreground)_50%,transparent_50%)]",
        mark === "no" && "text-muted-foreground",
      )}
    >
      {mark !== "partial" && <Icon name={markIcons[mark]} className="size-3" />}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function CellBody({ cell, marks }: { cell: CompareCell; marks: Record<CompareMark, string> }) {
  if (!cell.mark) return <span>{cell.text}</span>;
  return (
    <span className="flex items-start gap-2.5">
      <MarkGlyph mark={cell.mark} label={marks[cell.mark]} />
      <span className={cn(cell.mark === "no" && "text-muted-foreground")}>{cell.text}</span>
    </span>
  );
}

/**
 * The comparison page (/compare/, /zh/compare/): Abnormal Mail beside Gmail, Outlook.com, iCloud Mail, Proton Mail and Fastmail.
 * Who it suits and who it does not come first, then the table, how it was made and every source. The other services' cells are
 * src/content/compare/, each backed by a provider page listed at the foot; Abnormal Mail's storage, trial and own domains are
 * read from the live catalog (src/lib/compare.ts), so the page is rendered per request like the pricing page.
 */
export function Compare({ lang, catalog }: { lang: Lang; catalog: ShopCatalog | null }) {
  const { t, links, path } = getCopy(lang);
  const c = t.compare;
  const content = compareContent[lang];
  const view = compareView(lang, catalog);
  // The table's cells wrap and sit at the top, like the plan comparison on the pricing page.
  const cell = "h-auto px-4 py-3.5 text-left align-top whitespace-normal";
  // The row labels stay put while the services scroll sideways, with a background of their own and a hairline on the right.
  const labelCell =
    "sticky left-0 z-1 w-40 min-w-40 bg-background shadow-[inset_-1px_0_0_var(--border)] max-sm:w-32 max-sm:min-w-32 max-sm:px-3";
  // Abnormal Mail's column is tinted with the highlighter, so the eye can follow it down the table.
  const oursCell = "bg-highlight-muted/60";
  const email = site.contact.email;

  return (
    <>
      <JsonLd data={compareStructuredData(lang)} />
      <section aria-labelledby="compare-title">
        <PageHeader id="compare-title" eyebrow={c.eyebrow} title={content.title} dot={t.dot} lead={content.summary}>
          <p className="mt-6 text-sm/body text-muted-foreground">
            {c.reviewedLabel}
            {t.legal.colon}
            <time dateTime={content.reviewed}>{content.reviewed}</time>
          </p>
        </PageHeader>

        <Container className={sectionSpaceClassName}>
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-6 md:p-7" aria-labelledby="compare-fit">
              <h2 id="compare-fit" className="text-lg leading-[1.4] font-semibold tracking-title">
                {content.fit.title}
              </h2>
              <ul className="mt-5 grid gap-3.5 text-base/prose">
                {content.fit.items.map((item) => (
                  <li className="flex items-start gap-3" key={item}>
                    <Icon name="check" className="mt-1 size-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6 md:p-7" aria-labelledby="compare-not-fit">
              <h2 id="compare-not-fit" className="text-lg leading-[1.4] font-semibold tracking-title">
                {content.notFit.title}
              </h2>
              <ul className="mt-5 grid gap-3.5 text-base/prose text-muted-foreground">
                {view.notFit.map((item) => (
                  <li className="flex items-start gap-3" key={item}>
                    <Icon name="minus" className="mt-1 size-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <h2 id="compare-table" className="mt-16 font-serif text-2xl font-medium tracking-heading max-md:mt-12">
            {content.tableTitle}
          </h2>
          <p className="mt-2 max-w-160 text-base/prose text-muted-foreground">{content.tableCaption}</p>
          <div className="mt-6 overflow-hidden rounded-panel border border-border">
            <Table className="min-w-260 table-fixed text-sm/body" aria-labelledby="compare-table">
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className={cn(cell, labelCell)}>
                    <span className="sr-only">{content.tableTitle}</span>
                  </TableHead>
                  {view.columns.map((column) => (
                    <TableHead
                      scope="col"
                      key={column.id}
                      className={cn(cell, "w-36", column.id === "ours" && oursCell)}
                    >
                      <span className="block text-base font-semibold text-foreground">{column.name}</span>
                      <span className="mt-0.5 block text-xs/body font-normal text-muted-foreground">{column.plan}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {compareRows.map((row) => (
                  <TableRow className="hover:bg-transparent" key={row}>
                    <TableHead
                      scope="row"
                      className={cn(cell, labelCell, "text-sm/body font-normal text-muted-foreground")}
                    >
                      {content.rows[row]}
                    </TableHead>
                    {view.columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(cell, "wrap-break-word", column.id === "ours" && oursCell)}
                      >
                        <CellBody cell={column.cells[row]} marks={content.marks} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5">
            <h3 className="sr-only">{c.legendLabel}</h3>
            <ul className="flex flex-wrap gap-x-7 gap-y-3 text-sm/body text-muted-foreground">
              {(["yes", "partial", "no"] as const).map((mark) => (
                <li className="flex items-start gap-2.5" key={mark}>
                  <MarkGlyph mark={mark} label={content.marks[mark]} />
                  <span>{c.legend[mark]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={links.shop}>
                {c.buy} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={path("/pricing/")}>
                {c.pricingLink} <Icon name="arrow" className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-16 grid gap-12 border-t border-border pt-12 max-md:mt-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <h2 className="text-lg leading-[1.4] font-semibold tracking-title">{content.method.title}</h2>
              <div className="mt-4 grid gap-4 text-base/prose text-muted-foreground">
                {content.method.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p>
                  {fillTemplate(content.method.report, {
                    email: (
                      <TextLink key="email" href={`mailto:${email}?subject=${encodeURIComponent(c.navLabel)}`}>
                        {email}
                      </TextLink>
                    ),
                  })}
                </p>
                <p className="text-sm/body">{content.trademarks}</p>
              </div>
            </div>
            <div>
              <h2 className="text-lg leading-[1.4] font-semibold tracking-title">{content.sourcesTitle}</h2>
              <div className="mt-4 grid gap-7 sm:grid-cols-2">
                {view.sources.map((source) => (
                  <div key={source.rival}>
                    <h3 className="text-sm/body font-semibold">{source.name}</h3>
                    <ul className="mt-2 grid gap-1.5 text-sm/body">
                      {source.links.map((link) => (
                        <li key={link.url}>
                          <TextLink href={link.url}>{link.label}</TextLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
