import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { WebmailDemo } from "./WebmailDemo";

/**
 * "Try it yourself": the interactive WebMail demo (WebmailDemo), under the screenshots. The heading is rendered here on the server; the
 * demo gets only its own copy through props, so the browser bundle carries one language's sample content and nothing else of the copy.
 */
export function Demo({ lang }: { lang: Lang }) {
  const { t } = useCopy(lang);
  const d = t.demo;

  return (
    <section className="border-t border-border" id="demo" aria-labelledby="demo-title">
      <Container className={sectionSpaceClassName}>
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">{d.eyebrow}</Eyebrow>
            <SectionTitle id="demo-title">
              {d.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="max-w-[34rem] pb-[0.2rem] text-md/prose text-muted-foreground">{d.description}</p>
        </div>
        <div {...reveal(1)}>
          <WebmailDemo copy={{ label: d.label, ui: d.ui, labels: d.labels, mails: d.mails, events: d.events }} />
        </div>
        <p className="mt-6 text-sm/body text-muted-foreground">{d.note}</p>
      </Container>
    </section>
  );
}
