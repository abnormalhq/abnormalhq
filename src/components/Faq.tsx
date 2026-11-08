import { Container } from "@/components/ui/container";
import { Disclosure, DisclosureContent, DisclosureList, DisclosureTrigger } from "@/components/ui/disclosure";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";

export function Faq({ lang }: { lang: Lang }) {
  const { t } = useCopy(lang);
  return (
    <Container asChild>
      <section
        className={cn(sectionSpaceClassName, "grid gap-10 lg:grid-cols-[0.85fr_1.3fr] lg:gap-20")}
        id="faq"
        aria-labelledby="faq-title"
      >
        <div className="lg:pt-3">
          <Eyebrow lang="en">
            <span className="mr-1">05 /</span>
            {t.faq.eyebrow}
          </Eyebrow>
          <SectionTitle id="faq-title">
            {t.faq.title}
            <HeadingMark>{t.dot}</HeadingMark>
          </SectionTitle>
          <p className="mt-4 text-md/prose text-muted-foreground">{t.faq.description}</p>
          <InquiryButton>
            <TextLink asChild className="mt-6 lg:mt-8">
              <button type="button">
                {t.faq.contact} <Icon name="up-right" className="size-4" />
              </button>
            </TextLink>
          </InquiryButton>
        </div>
        <DisclosureList>
          {t.faq.items.map(({ question, answer }, index) => (
            <Disclosure key={question}>
              <DisclosureTrigger>
                <span className="shrink-0 text-xs/[1.7] text-muted-foreground" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-md/[1.7] font-medium">{question}</span>
              </DisclosureTrigger>
              <DisclosureContent className="mr-11 ml-[2.15rem] max-[23.4375rem]:mr-0 max-[23.4375rem]:ml-6">
                <p>{answer}</p>
              </DisclosureContent>
            </Disclosure>
          ))}
        </DisclosureList>
      </section>
    </Container>
  );
}
