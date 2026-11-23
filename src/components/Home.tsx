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
        <section aria-labelledby="closing-title" className="border-t border-border pt-24 text-center max-md:pt-16">
          <div className="flex flex-col items-center" {...reveal()}>
            <Eyebrow lang="en">{t.closing.eyebrow}</Eyebrow>
            <h2
              className="mx-auto mt-6 max-w-[14em] font-heading text-[clamp(2.25rem,5vw,4rem)] leading-[1.1] font-semibold tracking-[-0.03em]"
              id="closing-title"
            >
              {t.closing.titleLines[0]}
              {t.space}
              <br className="hidden max-md:block" />
              {/* The signal color: yellow on the ink, ink on paper, where yellow text would not read. */}
              <span className="text-signal">
                {t.closing.titleLines[1]}
                {t.dot}
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-[40rem] text-md/prose text-muted-foreground">{t.closing.body}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="highlight">
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
        </section>
      </Container>
    </>
  );
}
