import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Marker } from "@/components/ui/marker";
import { Eyebrow, HeadingMark } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";

/** The family entrance: one marked phrase and a quiet ink frame, not a simulated product interface. */
export function Hero({ lang }: { lang: Lang }) {
  const { t } = useCopy(lang);
  const h = t.hero;

  return (
    <Container asChild>
      <section
        className="grid items-center gap-10 py-14 md:grid-cols-[1.25fr_0.75fr] md:gap-14 md:py-20 lg:py-24"
        aria-labelledby="hero-title"
      >
        <div className="min-w-0">
          <Eyebrow className="animate-rise" lang="en">
            {h.eyebrow}
          </Eyebrow>
          <h1
            className="my-6 animate-rise font-heading text-[clamp(2.25rem,4.4vw,3.5rem)] leading-[1.2] font-semibold tracking-[-0.025em] [animation-delay:70ms]"
            id="hero-title"
          >
            {h.titleLines[0]}
            <br />
            {h.titleLines[1]}
            <Marker className="animate-mark bg-left bg-no-repeat [background-size:100%_100%] [animation-delay:420ms]">
              {h.titleLines[2]}
            </Marker>
            <HeadingMark>{t.dot}</HeadingMark>
          </h1>
          <p className="max-w-lg animate-rise text-md/prose text-muted-foreground [animation-delay:140ms]">
            {h.description.join(" ")}
          </p>
          <div className="mt-7 flex animate-rise flex-wrap items-center gap-3 [animation-delay:210ms]">
            <Button asChild size="lg">
              <a href="#products">
                {h.explore} <Icon name="arrow" className="size-4" />
              </a>
            </Button>
            <InquiryButton>
              <Button variant="outline" size="lg">
                {h.inquire} <Icon name="up-right" className="size-4" />
              </Button>
            </InquiryButton>
          </div>
        </div>
        {/* Paper stays outside an ink scope so both themes use their own reading surface. No idle motion or shadow. */}
        <div className="w-full max-w-sm rounded-panel bg-ink p-5 md:justify-self-end md:p-6">
          <div className="rounded-mark bg-background p-6 text-foreground lg:p-8">
            <p className="font-mono text-xs/body text-muted-foreground" lang="en">
              {h.noteLabel}
            </p>
            <p className="mt-8 font-heading text-2xl/[1.4] font-semibold tracking-[-0.02em] lg:text-3xl/[1.4]">
              {h.note[0]}
              <br />
              {h.note[1]}
            </p>
            <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
              <span className="font-heading text-md/body font-semibold" lang="en">
                abnormal.
              </span>
              <Icon name="up-right" className="size-5" />
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}
