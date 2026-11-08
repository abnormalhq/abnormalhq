import { Container } from "@/components/ui/container";
import { IconTile } from "@/components/ui/icon-tile";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";

export function Process({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  return (
    <section className="border-t border-border" id="how-it-works" aria-labelledby="process-title">
      <Container className={sectionSpaceClassName}>
        <div className="mb-11 flex flex-col gap-5 md:mb-[3.75rem] md:flex-row md:items-end md:justify-between md:gap-8">
          <div>
            <Eyebrow lang="en">
              <span className="mr-1">04 /</span>
              {t.process.eyebrow}
            </Eyebrow>
            <SectionTitle id="process-title">
              {t.process.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="text-md/prose text-muted-foreground md:shrink-0">
            {t.process.intro[0]}
            {t.space}
            <br className="hidden md:block" />
            {t.process.intro[1]}
          </p>
        </div>
        <div className="grid gap-9 md:grid-cols-2 md:gap-10 lg:grid-cols-4">
          {t.process.steps.map((step, index) => (
            <article className="min-w-0" key={step.title}>
              <div className="mb-[1.3rem] flex items-center gap-5 md:mb-7">
                {/*
                 * The number looks highlighted with a marker: a band of yellow across its lower half. The text uses the foreground color, half on the
                 * page background and half on the yellow, so dark mode swaps in a dim yellow and the light text stays clear on both (11.5:1).
                 */}
                <span
                  className="bg-[linear-gradient(transparent_56%,var(--step-band)_56%_90%,transparent_90%)] px-[0.06em] text-[2.75rem] leading-none font-light tracking-[-0.04em] text-foreground [--step-band:var(--highlight)] md:text-[3.25rem] dark:[--step-band:var(--highlight-muted)]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
                <IconTile variant="outline">
                  <Icon name={step.icon} />
                </IconTile>
              </div>
              <h3 className="mb-[0.65rem] text-[18px] leading-[1.4]">{step.title}</h3>
              <p className="max-w-[28rem] text-md/prose text-muted-foreground">{step.description}</p>
              <TextLink className="mt-[0.9rem]" href={links[step.link]}>
                {step.action} <Icon name="up-right" className="size-3.5" />
              </TextLink>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
