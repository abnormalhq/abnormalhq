import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Prose } from "@/components/ui/prose";
import { Eyebrow, HeadingMark, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { LegalFrontmatter, LegalHeading } from "@/content/legal/types";
import { site, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { contactChannels } from "@/lib/inquiry";
import { legalSections } from "@/lib/legal";
import { legalStructuredData } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";
import { TocSpy } from "./TocSpy";

export function LegalDocument({
  lang,
  frontmatter,
  headings,
  href: currentPage,
  children,
}: {
  lang: Lang;
  frontmatter: LegalFrontmatter;
  headings: readonly LegalHeading[];
  /** Page path without the language prefix, such as /privacy/. */
  href: string;
  /** The MDX body. */
  children: ReactNode;
}) {
  const { title, eyebrow, summary, effective, updated, highlights } = frontmatter;
  const { t, path } = useCopy(lang);
  const l = t.legal;
  const relatedPages = t.legalPages.filter(({ path: page }) => page !== currentPage);
  const sections = [...legalSections(headings), { slug: "contact", text: l.contactTitle }];

  const dateFormatter = new Intl.DateTimeFormat(l.dateLocale, { dateStyle: "long", timeZone: "UTC" });
  const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T00:00:00Z`));

  const contacts = contactChannels(site.contact, l.contactLabels);

  return (
    <>
      <JsonLd data={legalStructuredData(lang, currentPage, frontmatter)} />
      <section className="relative border-b border-border" aria-labelledby="legal-title">
        <Container className="flex flex-col gap-10 py-14 md:py-[4.5rem] lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="max-w-[40rem]">
            <Eyebrow lang="en">{eyebrow}</Eyebrow>
            <h1 className="mt-4 text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.25]" id="legal-title">
              {title}
              <HeadingMark>{t.dot}</HeadingMark>
            </h1>
            <p className="mt-5 text-md/prose text-muted-foreground">{summary}</p>
          </div>
          <dl className="flex shrink-0 flex-wrap gap-x-10 gap-y-6 border-t border-border pt-5 lg:min-w-44 lg:flex-col lg:gap-[1.4rem] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <div>
              <dt className="text-xs/body text-muted-foreground">{l.effective}</dt>
              <dd className="mt-[0.4rem] text-base/body font-medium">
                <time dateTime={effective}>{formatDate(effective)}</time>
              </dd>
            </div>
            <div>
              <dt className="text-xs/body text-muted-foreground">{l.updated}</dt>
              <dd className="mt-[0.4rem] text-base/body font-medium">
                <time dateTime={updated}>{formatDate(updated)}</time>
              </dd>
            </div>
          </dl>
        </Container>
      </section>

      <Container className={cn(sectionSpaceClassName, "grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-20")}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TocSpy>
            <nav aria-label={l.tocLabel}>
              <p className="flex items-center justify-between gap-4 text-sm/body font-medium text-foreground">
                {l.tocHint}{" "}
                <span className="text-[11px] font-normal tracking-[0.06em] text-muted-foreground uppercase" lang="en">
                  {l.tocKicker}
                </span>
              </p>
              <ol className="mt-4 flex flex-wrap gap-2 lg:grid lg:gap-0 lg:border-t lg:border-border">
                {sections.map(({ slug, text }, index) => (
                  <li className="lg:border-b lg:border-border" key={slug}>
                    <a
                      className="inline-flex items-baseline gap-[0.65rem] rounded-control border border-input bg-control px-[0.85rem] py-[0.6rem] text-sm/[1.6] text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground aria-[current=location]:text-foreground lg:w-full lg:rounded-none lg:border-0 lg:bg-transparent lg:px-[0.2rem] lg:py-[0.85rem] lg:hover:bg-accent lg:aria-[current=location]:font-medium lg:aria-[current=location]:shadow-[inset_2px_0_0_var(--signal)] lg:aria-[current=location]:pl-[0.7rem]"
                      href={`#${slug}`}
                    >
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </TocSpy>
        </aside>

        <article className="min-w-0">
          <Card asChild className="block p-[1.4rem] md:px-8 md:py-7">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-[0.6rem] border-b border-border pb-4">
                <p className="text-md/body font-semibold">{l.highlights}</p>
                <p className="text-xs/prose text-muted-foreground">{l.highlightsNote}</p>
              </div>
              <ul className="mt-[1.15rem] grid gap-4 md:grid-cols-2 md:gap-x-6">
                {highlights.map((item) => (
                  <li className="flex items-start gap-[0.6rem] text-base/[1.75]" key={item}>
                    <Icon name="check" className="mt-1 size-4 shrink-0 text-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Prose>
            <div>{children}</div>
            <section id="contact">
              <h2>{l.contactTitle}</h2>
              <p>{l.contactBody(title)}</p>
              {contacts.length > 0 ? (
                <ul>
                  {contacts.map(({ label, value, href }) => (
                    <li key={label}>
                      {label}
                      {l.colon}
                      {href ? (
                        <a href={href} rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}>
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{l.contactPending}</p>
              )}
            </section>
          </Prose>

          <nav
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-7"
            aria-label={l.relatedLabel}
          >
            {relatedPages.map(({ path: page, label }) => (
              <TextLink asChild key={page}>
                <Link href={path(page)}>
                  {l.seeAlso(label)} <Icon name="up-right" className="size-4" />
                </Link>
              </TextLink>
            ))}
            <TextLink asChild>
              <Link href={path("/")}>
                {l.backHome} <Icon name="arrow" className="size-4" />
              </Link>
            </TextLink>
          </nav>
        </article>
      </Container>
    </>
  );
}
