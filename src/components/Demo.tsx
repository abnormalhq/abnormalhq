import { Container } from "@/components/ui/container";
import { Eyebrow, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import { WebmailDemo } from "./WebmailDemo";

/**
 * "Try it yourself": the real WebMail on a sample mailbox (WebmailDemo, WebMail's /demo in a frame), under the feature wall. The heading
 * is rendered here on the server; the frame gets only the language and its title through props.
 */
export function Demo({ lang }: { lang: Lang }) {
  const { t } = getCopy(lang);
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
              {t.dot}
            </SectionTitle>
          </div>
          <p className="max-w-136 pb-0.75 text-md/prose text-muted-foreground">{d.description}</p>
        </div>
        <div {...reveal(1)}>
          <WebmailDemo lang={lang} label={d.label} />
        </div>
      </Container>
    </section>
  );
}
