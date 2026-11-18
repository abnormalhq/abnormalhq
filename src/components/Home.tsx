import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { homeStructuredData } from "@/lib/structured-data";
import { Demo } from "./Demo";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { Products } from "./Products";
import { DoppelWaitlist } from "./DoppelWaitlist";
import { MailIntro } from "./MailIntro";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";
import { JsonLd } from "@/components/ui/json-ld";
import { PricingSection } from "./PricingSection";
import { Process } from "./Process";
import { PromoVideo } from "./PromoVideo";
import { Screens } from "./Screens";
import { ScrollReveal } from "./ScrollReveal";
import { Start } from "./Start";
import { Subscriptions } from "./Subscriptions";

/** Home page, shared by src/app/(en)/page.tsx (English) and src/app/(zh)/zh/page.tsx (Chinese). */
export function Home({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  return (
    <>
      <JsonLd data={homeStructuredData(lang)} />
      <ScrollReveal />
      <Hero lang={lang} />
      <Products lang={lang} />
      <DoppelWaitlist lang={lang} copy={t.waitlist} />
      <MailIntro lang={lang} />
      <PromoVideo lang={lang} />
      <Screens lang={lang} />
      <Demo lang={lang} />
      <Features lang={lang} />
      <Start lang={lang} />
      <PricingSection lang={lang} />
      <Subscriptions lang={lang} />
      <Process lang={lang} />
      <Faq lang={lang} />
      <Container asChild className="pb-20 max-md:pb-14">
        <section aria-labelledby="closing-title">
          {/*
           * Closing as the brand's ink shell: ink frame around a paper sheet. Paper is a sibling of any `ink`
           * chrome, never nested in it — here the frame is only bg-ink padding around the paper panel.
           */}
          <div className="rounded-panel bg-ink p-2.5 md:p-3" {...reveal()}>
            <div className="relative isolate flex items-center justify-between gap-8 overflow-hidden rounded-[calc(var(--radius-panel)-0.4rem)] bg-background px-14 py-12 max-lg:p-11 max-md:flex-col max-md:items-start max-md:gap-7 max-md:px-6 max-md:py-8">
              <div
                className="absolute top-[-4rem] left-[48%] -z-1 grid size-96 place-items-center rounded-full border border-border before:absolute before:inset-11 before:rounded-full before:border before:border-border max-md:left-1/4"
                aria-hidden="true"
              >
                <span className="rotate-[-18deg] font-heading text-[15rem] leading-none font-light text-surface">
                  @
                </span>
              </div>
              <div className="relative min-w-0">
                <Eyebrow lang="en">{t.closing.eyebrow}</Eyebrow>
                <h2
                  className="mt-4 font-heading text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.3] font-semibold tracking-[-0.02em] max-phone:text-[1.6rem]"
                  id="closing-title"
                >
                  {t.closing.titleLines[0]}
                  {t.space}
                  <br className="hidden max-phone:block" />
                  {t.closing.titleLines[1]}
                  <HeadingMark>{t.dot}</HeadingMark>
                </h2>
                <span className="mt-3 block text-md/prose text-muted-foreground max-md:text-base/prose">
                  {t.closing.body}
                </span>
              </div>
              <div className="relative flex shrink-0 flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2.5">
                  <a href={links.shop}>
                    {t.closing.buy} <Icon name="arrow" className="size-4" />
                  </a>
                </Button>
                <InquiryButton>
                  <Button variant="outline" size="lg" className="gap-2.5">
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
