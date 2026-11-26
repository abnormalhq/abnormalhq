import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { homeStructuredData } from "@/lib/structured-data";
import { Demo } from "./Demo";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { DoppelWaitlist } from "./DoppelWaitlist";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";
import { JsonLd } from "@/components/ui/json-ld";
import { MarkedLine } from "./MarkedLine";
import { PricingSection } from "./PricingSection";
import { PromoVideo } from "./PromoVideo";
import { ScrollReveal } from "./ScrollReveal";
import { Start } from "./Start";

/**
 * Home page, shared by src/app/(en)/page.tsx (English) and src/app/(zh)/zh/page.tsx (Chinese).
 * The product leads: a stage with a tab per product, then what Mail does, the demo to try it, the film, the plans,
 * where to start, Doppel's waitlist, the questions and a closing line.
 */
export function Home({ lang }: { lang: Lang }) {
  const { t, links } = getCopy(lang);
  return (
    <>
      <JsonLd data={homeStructuredData(lang)} />
      <ScrollReveal />
      <Hero lang={lang} />
      <Features lang={lang} />
      <Demo lang={lang} />
      <PromoVideo lang={lang} />
      <PricingSection lang={lang} />
      <Start lang={lang} />
      <DoppelWaitlist lang={lang} copy={t.waitlist} />
      <Faq lang={lang} />
      <Container asChild className="pb-24 max-md:pb-16">
        <section aria-labelledby="closing-title" className="border-t border-border pt-24 max-md:pt-16">
          {/* The last page of the magazine: the line set large and flush left, its one word under the highlighter. */}
          <div {...reveal()}>
            <Eyebrow lang="en">{t.closing.eyebrow}</Eyebrow>
            <h2
              className="mt-6 max-w-[14em] font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.04] font-normal tracking-heading text-balance [&:lang(zh)]:tracking-normal"
              id="closing-title"
            >
              {t.closing.titleLines[0]}
              {t.space}
              <br className="hidden md:block" />
              <MarkedLine line={t.closing.titleLines[1]} marked={t.closing.marked} />
              {t.dot}
            </h2>
            <div className="mt-10 grid gap-8 border-t border-border pt-6 md:grid-cols-[minmax(0,34rem)_1fr] md:gap-12">
              <p className="text-md/prose text-pretty text-muted-foreground">{t.closing.body}</p>
              <div className="flex flex-wrap items-start gap-3 md:justify-end">
                <Button asChild size="lg">
                  <a href={links.shop}>
                    {t.closing.buy} <Icon name="up-right" className="size-4" />
                  </a>
                </Button>
                <InquiryButton>
                  <Button variant="outline" size="lg">
                    {t.closing.custom} <Icon name="up-right" className="size-4" />
                  </Button>
                </InquiryButton>
              </div>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}
