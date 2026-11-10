import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { HomePricing } from "./HomePricing";
import { Icon } from "./Icon";
import { Included } from "./Included";

/**
 * The home page's "Plans and prices": the plans on sale with their live prices (read in the browser, see HomePricing), then what every
 * mailbox gets whatever the plan. The full comparison is on the pricing page, linked from here.
 */
export function PricingSection({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  const p = t.pricing;
  return (
    <section className="border-t border-border" id="pricing" aria-labelledby="pricing-title">
      <Container className={sectionSpaceClassName}>
        <div className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start">
          <div>
            <Eyebrow lang="en">
              <span className="mr-1">03 /</span> {p.eyebrow}
            </Eyebrow>
            <SectionTitle id="pricing-title">
              {p.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <div className="pb-[0.2rem] md:text-right">
            <p className="text-md/prose text-muted-foreground">
              {p.intro[0]}
              {t.space}
              <br className="hidden md:block" />
              {p.intro[1]}
            </p>
            <TextLink className="mt-2" href={links.pricing}>
              {p.compareLink} <Icon name="up-right" className="size-3.5" />
            </TextLink>
          </div>
        </div>
        <HomePricing
          lang={lang}
          shop={links.shop}
          copy={{
            plan: p.plan,
            compare: p.compare,
            loading: p.loading,
            closedTitle: p.closedTitle,
            closedBody: p.closedBody,
            errorTitle: p.errorTitle,
            errorBody: p.errorBody,
            retry: p.retry,
            shopLink: p.shopLink,
            priceNote: p.priceNote,
          }}
        />
        {/* Without JavaScript the plans above never load; the pricing page renders them on the server. */}
        <noscript>
          <p className="mt-4 text-base/prose text-muted-foreground">
            <a className="underline underline-offset-4" href={links.pricing}>
              {p.compareLink}
            </a>
          </p>
        </noscript>
        <div className="mt-14 max-md:mt-11">
          <Included lang={lang} id="pricing-included-title" />
        </div>
      </Container>
    </section>
  );
}
