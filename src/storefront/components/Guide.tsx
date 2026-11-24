/**
 * Guide page: the table of contents and the reading column share section anchors; the body reuses guide from i18n.ts.
 */
import Link from "next/link";
import { Prose } from "@/components/ui/prose";
import { Eyebrow, PageLead, PageTitle } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { copy } from "@/storefront/copy";
import { LANG_PATHS, storePath, type GuideBlock, type Lang } from "@/storefront/i18n";
import { withBase } from "@/storefront/site";
import { Toc } from "@/components/ui/toc";
import { RichText } from "@/components/RichText";

export function Guide({ lang }: { lang: Lang }) {
  const t = copy[lang].guide;
  const base = withBase(LANG_PATHS[lang]);

  return (
    <div className="pt-6 wrap-anywhere max-guide:pt-4">
      <TextLink asChild className="min-h-11 gap-2.5 text-base/body font-normal">
        <Link href={storePath(lang)}>
          <span aria-hidden="true">←</span> {t.back}
        </Link>
      </TextLink>
      <div className="mt-10 grid grid-cols-[220px_minmax(0,1fr)] gap-x-[clamp(40px,6vw,80px)] [grid-template-areas:'contents_heading'_'contents_body'] max-guide-lg:grid-cols-[180px_minmax(0,1fr)] max-guide-lg:gap-x-9 max-guide:mt-7 max-guide:grid-cols-[minmax(0,1fr)] max-guide:[grid-template-areas:'heading'_'contents'_'body']">
        <header className="max-w-185 pb-10 [grid-area:heading] max-guide:pb-7">
          <Eyebrow className="mb-5.5 gap-2.25 text-xs/body max-guide:mb-4.5">{t.eyebrow}</Eyebrow>
          <PageTitle className="mt-0 max-w-[13ch]">{t.heading}</PageTitle>
          <PageLead className="max-w-[66ch]">{t.lede}</PageLead>
        </header>
        <aside className="sticky top-24 self-start pt-1 [grid-area:contents] max-guide:static max-guide:mb-7 max-guide:rounded-mark max-guide:border max-guide:border-border max-guide:bg-surface max-guide:p-5">
          <Toc label={t.contents} className="text-[length:inherit]">
            <p className="flex items-center justify-between gap-3 border-b border-border pr-3 pb-3.75 text-xs/body font-medium tracking-caps text-muted-foreground uppercase max-guide:pr-0 max-guide:pb-3">
              {t.contents}
              <span className="font-normal">{String(t.sections.length).padStart(2, "0")}</span>
            </p>
            <ol className="mt-3.5 grid gap-1 max-guide:mt-2.5 max-guide:grid-cols-2 max-guide:gap-x-3 max-guide:gap-y-0.5">
              {t.sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    className="flex min-h-10 items-baseline gap-3 rounded-control px-2.5 py-2.25 text-base/[1.6] text-muted-foreground transition-colors duration-150 hover:bg-control hover:text-foreground aria-[current=location]:bg-control aria-[current=location]:text-foreground focus-visible:bg-control focus-visible:text-foreground max-guide-lg:gap-2.5 max-guide-lg:px-1.5 max-guide:min-h-11 max-guide:gap-2 max-guide:px-0 max-guide:py-2 max-guide:text-xs/[1.6] max-guide:hover:bg-background max-guide:focus-visible:bg-background max-guide:aria-[current=location]:bg-transparent"
                    href={`#guide-section-${index + 1}`}
                  >
                    <span className="shrink-0 text-xs/[1.6] tracking-[0.02em]" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </Toc>
        </aside>
        <div className="max-w-185 min-w-0 [grid-area:body]">
          {t.sections.map((section, index) => (
            <section
              className="group/section scroll-mt-8 border-t border-border pt-8.5 pb-9.5 max-guide:pt-7 max-guide:pb-7.5"
              id={`guide-section-${index + 1}`}
              aria-labelledby={`guide-title-${index + 1}`}
              key={section.title}
            >
              <div className="mb-5.5 flex items-baseline gap-3.5 max-guide:mb-4.5 max-guide:gap-3">
                {/* The section that was jumped to is "current": its number turns ink-on-highlight-yellow. */}
                <span
                  className="text-xs/body text-muted-foreground group-target/section:rounded-chip group-target/section:bg-highlight group-target/section:px-1.25 group-target/section:py-px group-target/section:text-highlight-foreground"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="text-2xl/[1.35] max-guide:text-xl/[1.35]" id={`guide-title-${index + 1}`}>
                  {section.title}
                </h2>
              </div>
              <Prose className="text-md/prose [&_a]:decoration-border [&_a]:decoration-1 [&_a:hover]:decoration-foreground [&_li]:pl-1.25 [&_li]:marker:text-sm [&_li]:marker:text-foreground [&_li+li]:mt-3.5 [&_ol]:my-0 [&_ol]:block [&_ol]:pl-6 [&_ol+p]:mt-4.5 [&_p+ol]:mt-4.5 [&_p+p]:mt-4.5 [&_p+ul]:mt-4.5 [&_ul]:my-0 [&_ul]:block [&_ul]:pl-6 [&_ul+p]:mt-4.5">
                {section.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} base={base} />
                ))}
              </Prose>
            </section>
          ))}
          <a
            className="flex min-h-14 items-center justify-between gap-5 border-t border-border text-sm/body text-muted-foreground transition-colors duration-200 hover:text-foreground"
            href="#main"
          >
            {t.backToTop}
            <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function Block({ block, base }: { block: GuideBlock; base: string }) {
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
