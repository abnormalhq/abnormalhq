import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { helpArticles, helpPath } from "@/content/help";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { planViews } from "@/lib/pricing";
import { pricingStructuredData } from "@/lib/structured-data";
import { catalogDomains, type ShopCatalog } from "@/storefront/lib/catalog";
import { AddressCheck } from "./AddressCheck";
import { HelpLinks } from "./HelpLinks";
import { Icon } from "./Icon";
import { Included } from "./Included";
import { JsonLd } from "./JsonLd";
import { PlanCards, PlanComparison, PlanNotice } from "./PlanCards";

/**
 * The pricing page (/pricing/, /zh/pricing/): every plan on sale with its live price, the comparison table, the address check and what
 * every mailbox gets. `catalog` is read on the Worker for each request (src/storefront/lib/catalog-server.ts), so the page is not
 * prerendered and the HTML, the Markdown version and the structured data all carry the shop's prices of that moment.
 * null means the catalog could not be read: the page says so and still shows everything that does not depend on it.
 */
export function Pricing({ lang, catalog }: { lang: Lang; catalog: ShopCatalog | null }) {
  const { t, links, path } = useCopy(lang);
  const p = t.pricing;
  const plans = catalog ? planViews(catalog, lang, p, links.shop) : [];
  const billingArticles = helpArticles(lang)
    .filter((article) => article.category === "billing")
    .map(({ slug, title, summary }) => ({ href: path(helpPath(slug)), title, summary }));
  const shopButton = (
    <Button asChild variant="outline" size="lg">
      <a href={links.shop}>
        {p.shopLink} <Icon name="up-right" className="size-4" />
      </a>
    </Button>
  );

  return (
    <>
      <JsonLd data={pricingStructuredData(lang, plans)} />
      <section aria-labelledby="pricing-title">
        <Container className={sectionSpaceClassName}>
          <Eyebrow lang="en">{p.eyebrow}</Eyebrow>
          <SectionTitle asChild>
            <h1 id="pricing-title">
              {p.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </h1>
          </SectionTitle>
          <p className="mt-4 max-w-2xl text-md/prose text-muted-foreground">{p.pageIntro}</p>

          {catalog?.available && catalog.addressCheck && (
            <AddressCheck
              className="mt-8 max-w-[30rem]"
              lang={lang}
              copy={p.check}
              shop={links.shop}
              domains={catalogDomains(catalog)}
            />
          )}

          <div className="mt-10">
            {!catalog ? (
              <PlanNotice
                title={p.errorTitle}
                actions={
                  <>
                    {/* The catalog is read while the page renders, so trying again is loading the page again. */}
                    <Button asChild size="lg">
                      <a href={path("/pricing/")}>{p.retry}</a>
                    </Button>
                    {shopButton}
                  </>
                }
              >
                {p.errorBody}
              </PlanNotice>
            ) : plans.length === 0 ? (
              <PlanNotice title={p.closedTitle} actions={shopButton}>
                {p.closedBody}
              </PlanNotice>
            ) : (
              <>
                <PlanCards plans={plans} copy={p} heading="h2" />
                <p className="mt-6 max-w-3xl text-xs/[1.9] text-muted-foreground">{p.priceNote}</p>
              </>
            )}
          </div>

          {plans.length > 1 && (
            <div className="mt-16 max-md:mt-12">
              <h2 className="text-2xl/[1.3] font-semibold tracking-[-0.02em]" id="pricing-compare-title">
                {p.compare.title}
                <HeadingMark>{t.dot}</HeadingMark>
              </h2>
              <p className="mt-2 mb-6 text-base/prose text-muted-foreground">{p.compare.intro}</p>
              <PlanComparison plans={plans} copy={p} labelledBy="pricing-compare-title" />
            </div>
          )}

          <div className="mt-16 max-md:mt-12">
            <Included lang={lang} heading="h2" id="pricing-included-title" />
          </div>

          {/* Renewals, codes, team plans and deleting a mailbox are answered in the help center; link them where the question comes up. */}
          <HelpLinks
            className="mt-16 max-w-3xl max-md:mt-12"
            id="pricing-questions-title"
            title={p.questions.title}
            entries={billingArticles}
          >
            <TextLink asChild className="mt-5">
              <Link href={path("/help/")}>
                {p.questions.all} <Icon name="arrow" className="size-4" />
              </Link>
            </TextLink>
          </HelpLinks>
        </Container>
      </section>
    </>
  );
}
