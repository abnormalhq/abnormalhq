import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";
import { ProductCard } from "./ProductCard";

export function Subscriptions({ lang }: { lang: Lang }) {
  const { t } = useCopy(lang);
  const s = t.services;

  return (
    <section className="border-t border-border" id="services" aria-labelledby="services-title">
      <Container className={sectionSpaceClassName}>
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">
              <span className="mr-1">04 /</span> {s.eyebrow}
            </Eyebrow>
            <SectionTitle id="services-title">
              {s.titleLines[0]}
              {t.space}
              <br className="hidden max-phone:block" />
              {s.titleLines[1]}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="pb-[0.2rem] text-md/prose text-muted-foreground">
            {s.intro[0]}
            <br />
            {s.intro[1]}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {s.products.map((product, index) => (
            <ProductCard lang={lang} product={product} index={index} key={product.name} />
          ))}
        </div>
        <div className="mt-7 flex items-center justify-between gap-4 text-sm/body text-muted-foreground max-lg:flex-col max-lg:items-start max-lg:gap-1 max-sm:leading-[1.8]">
          <p className="flex flex-wrap items-center gap-[0.45rem]">
            <Icon name="chat" className="size-4" />
            {s.noteQuestion}
            <InquiryButton product={t.inquiry.otherProduct}>
              <Button variant="link" className="h-auto min-h-8 gap-[0.2rem] p-0 text-sm/[inherit] font-medium">
                {s.noteAction} <Icon name="up-right" className="size-3" />
              </Button>
            </InquiryButton>
          </p>
          <span>{s.noteFine}</span>
        </div>
      </Container>
    </section>
  );
}
