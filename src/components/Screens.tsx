import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import type { ScreenCopy } from "@/i18n/types";
import { reveal } from "@/lib/reveal";
import { screens, screenSrc, screenSrcSet, type Screen, type ScreenKey } from "@/lib/screens";
import { cn } from "@/lib/utils";

const byKey = (key: ScreenKey) => screens.find((screen) => screen.key === key)!;

/**
 * "Take a look": WebMail's real screens, in the page's language. The inbox runs the full width; the calendar and the phone share the row
 * below at the same height, so their columns are in the ratio of their widths at equal height (1440×900 beside 390×844).
 * The shots sit as paper windows in one ink shell — one product plane, not a wall of separate cards.
 * Plain <img> with srcset (the site runs on a Worker without an image service); width and height hold the layout while they load.
 */
export function Screens({ lang }: { lang: Lang }) {
  const { t } = getCopy(lang);
  const s = t.screens;

  return (
    <section className="border-t border-border" id="screens" aria-labelledby="screens-title">
      <Container className={sectionSpaceClassName}>
        <div
          className="mb-10 flex items-end justify-between gap-8 max-lg:gap-4 max-md:mb-7 max-md:flex-col max-md:items-start"
          {...reveal()}
        >
          <div>
            <Eyebrow lang="en">{s.eyebrow}</Eyebrow>
            <SectionTitle id="screens-title">
              {s.title}
              <HeadingMark>{t.dot}</HeadingMark>
            </SectionTitle>
          </div>
          <p className="max-w-[34rem] pb-[0.2rem] text-md/prose text-muted-foreground">{s.description}</p>
        </div>

        {/*
         * Ink shell around one paper sheet: same brand frame as the closing CTA. Shots share that plane with hairline
         * gaps instead of each floating as its own card.
         */}
        <div className="rounded-panel bg-ink p-2 md:p-2.5" {...reveal(1)}>
          <div className="space-y-5 overflow-hidden rounded-[calc(var(--radius-panel)-0.35rem)] bg-background p-4 md:space-y-5 md:p-5 lg:p-6">
            <Shot lang={lang} screen={byKey("inbox")} copy={s.inbox} sizes="(min-width: 1264px) 1136px, 100vw" />
            <div className="grid items-start gap-5 md:grid-cols-[1fr_0.289fr] md:gap-5 lg:gap-5">
              <Shot
                lang={lang}
                screen={byKey("calendar")}
                copy={s.calendar}
                sizes="(min-width: 1264px) 860px, (min-width: 768px) 72vw, 100vw"
              />
              <Shot
                lang={lang}
                screen={byKey("phone")}
                copy={s.phone}
                sizes="(min-width: 1264px) 248px, (min-width: 768px) 20vw, 280px"
                className="max-md:mx-auto max-md:w-[min(100%,280px)]"
                frameClassName="rounded-[1.15rem]"
              />
            </div>
            <p className="text-sm/body text-muted-foreground">{s.note}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Shot({
  lang,
  screen,
  copy,
  sizes,
  className,
  frameClassName,
}: {
  lang: Lang;
  screen: Screen;
  copy: ScreenCopy;
  sizes: string;
  className?: string;
  frameClassName?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      {/* Window into the product: thin border only, no card fill or shadow — the ink shell already frames the sheet. */}
      <div className={cn("overflow-hidden rounded-mark border border-border bg-card", frameClassName)}>
        {/* next/image would need an image service on the Worker; the widths are made ahead of time instead (src/lib/screens.ts). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="block h-auto w-full"
          src={screenSrc(lang, screen.key, screen.width)}
          srcSet={screenSrcSet(lang, screen)}
          sizes={sizes}
          width={screen.width}
          height={screen.height}
          alt={copy.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="mt-3 text-sm/[1.6]">
        <strong className="font-medium text-foreground">{copy.title}</strong>
        <span className="mt-1 block text-muted-foreground">{copy.description}</span>
      </figcaption>
    </figure>
  );
}
