import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { homeStructuredData } from "@/lib/structured-data";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";
import { JsonLd } from "./JsonLd";
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
      <Container className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-6 text-muted-foreground max-lg:justify-center max-md:flex-col">
        <p className="text-sm/body">
          {t.valueStrip.lead}
          <strong className="ml-2 font-medium text-foreground max-phone:ml-[0.15rem]">{t.valueStrip.strong}</strong>
        </p>
        <div className="flex items-center gap-8 max-lg:gap-6 max-md:flex-wrap max-md:justify-center max-md:gap-x-5 max-md:gap-y-3">
          {t.valueStrip.labels.map((label) => (
            <span className="inline-flex items-center gap-1.5 text-xs/body" key={label}>
              <Icon name="spark" className="size-3.5 text-brand" />
              {label}
            </span>
          ))}
        </div>
      </Container>
      <PromoVideo lang={lang} />
      <Screens lang={lang} />
      <Features lang={lang} />
      <Start lang={lang} />
      <PricingSection lang={lang} />
      <Subscriptions lang={lang} />
      <Process lang={lang} />
      <Faq lang={lang} />
      <Container asChild className="pb-20 max-md:pb-14">
        <section aria-labelledby="closing-title">
          {/* Closing panel: thin-bordered card with no fill and no shadow; decoration uses the border color only. */}
          <Card
            asChild
            className="relative isolate flex-row items-center justify-between gap-8 overflow-hidden px-14 py-12 max-lg:p-11 max-md:flex-col max-md:items-start max-md:gap-7 max-md:px-6 max-md:py-8"
            {...reveal()}
          >
            <div>
              <div
                className="absolute top-[-4rem] left-[48%] -z-1 grid size-96 place-items-center rounded-full border border-border before:absolute before:inset-11 before:rounded-full before:border before:border-border max-md:left-1/4"
                aria-hidden="true"
              >
                <span className="rotate-[-18deg] text-[15rem] leading-none font-light text-surface">@</span>
              </div>
              <div className="relative">
                <Eyebrow lang="en">{t.closing.eyebrow}</Eyebrow>
                <h2
                  className="mt-4 text-[clamp(1.75rem,2.6vw,2.25rem)] leading-[1.3] max-phone:text-[1.6rem]"
                  id="closing-title"
                >
                  {t.closing.titleLines[0]}
                  {t.space}
                  <br className="hidden max-phone:block" />
                  {t.closing.titleLines[1]}
                  {t.dot}
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
          </Card>
        </section>
      </Container>
    </>
  );
}
