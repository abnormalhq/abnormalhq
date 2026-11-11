import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";
import { Eyebrow, HeadingMark, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { DocBlock, DocSection } from "@/content/help/types";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { docBase, sectionId } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { RichText } from "@/storefront/components/RichText";

/**
 * A page of long-form content written as sections of paragraphs and lists (src/content/): a help article or the security
 * overview. The layout is the legal pages': a header with the title and lead, then a table of contents beside the reading
 * column, which is the registry's Prose (numbered second-level headings). A breadcrumb says where the page sits.
 * `children` follows the sections in the reading column: what to do next, or who to ask.
 */
export function DocArticle({
  lang,
  eyebrow,
  title,
  summary,
  trail,
  sections,
  meta,
  crumb,
  children,
}: {
  lang: Lang;
  /** Decorative English label above the title. */
  eyebrow: string;
  title: string;
  summary: string;
  /** The pages above this one, nearest last; the home page comes first by itself. Paths without the language prefix. */
  trail: readonly { label: string; path: string }[];
  sections: readonly DocSection[];
  /** A line under the lead, such as the date the page was last reviewed. */
  meta?: ReactNode;
  /** The page's name in the breadcrumb, when the title is too long for it. */
  crumb?: string;
  children?: ReactNode;
}) {
  const { t, path } = useCopy(lang);
  const h = t.help;
  const base = docBase(lang);

  return (
    <>
      <section className="border-b border-border" aria-labelledby="doc-title">
        <Container className="py-10 md:py-14">
          <Breadcrumb label={h.breadcrumbLabel}>
            <BreadcrumbList>
              {[{ label: h.home, path: "/" }, ...trail].map((entry) => (
                <Fragment key={entry.path}>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={path(entry.path)}>{entry.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ))}
              <BreadcrumbItem>
                <BreadcrumbPage>{crumb ?? title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="mt-8 max-w-[44rem] md:mt-10">
            <Eyebrow lang="en">{eyebrow}</Eyebrow>
            <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.25]" id="doc-title">
              {title}
              <HeadingMark>{t.dot}</HeadingMark>
            </h1>
            <p className="mt-5 text-md/prose text-muted-foreground">{summary}</p>
            {meta && <p className="mt-4 text-sm/body text-muted-foreground">{meta}</p>}
          </div>
        </Container>
      </section>

      <Container className={cn(sectionSpaceClassName, "grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-20")}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label={h.tocLabel}>
            <p className="text-sm/body font-medium text-foreground">{h.tocLabel}</p>
            <ol className="mt-4 flex flex-wrap gap-2 lg:grid lg:gap-0 lg:border-t lg:border-border">
              {sections.map((section, index) => (
                <li className="lg:border-b lg:border-border" key={section.title}>
                  <a
                    className="inline-flex items-baseline gap-[0.65rem] rounded-control border border-input bg-control px-[0.85rem] py-[0.6rem] text-sm/[1.6] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground lg:w-full lg:rounded-none lg:border-0 lg:bg-transparent lg:px-[0.2rem] lg:py-[0.85rem] lg:hover:bg-accent"
                    href={`#${sectionId(index)}`}
                  >
                    <span className="shrink-0 text-[11px] text-muted-foreground" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="max-w-[46rem] min-w-0">
          <Prose className="[&_h2]:scroll-mt-24 [&>section:first-child_h2]:mt-0">
            {sections.map((section, index) => (
              <section aria-labelledby={sectionId(index)} key={section.title}>
                <h2 id={sectionId(index)}>{section.title}</h2>
                {section.blocks.map((block, blockIndex) => (
                  <Block block={block} base={base} key={blockIndex} />
                ))}
              </section>
            ))}
          </Prose>
          {children}
        </article>
      </Container>
    </>
  );
}

function Block({ block, base }: { block: DocBlock; base: string }) {
  if ("p" in block) {
    return (
      <p>
        <RichText text={block.p} base={base} />
      </p>
    );
  }
  const items = "ol" in block ? block.ol : block.ul;
  const List = "ol" in block ? "ol" : "ul";
  return (
    <List>
      {items.map((item, index) => (
        <li key={index}>
          <RichText text={item} base={base} />
        </li>
      ))}
    </List>
  );
}
