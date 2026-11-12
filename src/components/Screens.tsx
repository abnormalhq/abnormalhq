import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import type { ScreenCopy } from "@/i18n/types";
import { reveal } from "@/lib/reveal";
import { screens, screenSrc, screenSrcSet, type Screen, type ScreenKey } from "@/lib/screens";
import { cn } from "@/lib/utils";

const byKey = (key: ScreenKey) => screens.find((screen) => screen.key === key)!;

/**
 * "Take a look": WebMail's real screens, in the page's language. The inbox runs the full width; the calendar and the phone share the row
 * below at the same height, so their columns are in the ratio of their widths at equal height (1440×900 beside 390×844).
 * Plain <img> with srcset (the site runs on a Worker without an image service); width and height hold the layout while they load.
 */
export function Screens({ lang }: { lang: Lang }) {
  const { t } = useCopy(lang);
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

        <Shot
          lang={lang}
          screen={byKey("inbox")}
          copy={s.inbox}
          sizes="(min-width: 1264px) 1184px, 100vw"
          {...reveal(1)}
        />
        <div className="mt-6 grid items-start gap-6 md:grid-cols-[1fr_0.289fr] md:gap-5 lg:gap-6">
          <Shot
            lang={lang}
            screen={byKey("calendar")}
            copy={s.calendar}
            sizes="(min-width: 1264px) 900px, (min-width: 768px) 75vw, 100vw"
            {...reveal(1)}
          />
          <Shot
            lang={lang}
            screen={byKey("phone")}
            copy={s.phone}
            sizes="(min-width: 1264px) 260px, (min-width: 768px) 22vw, 280px"
            className="max-md:mx-auto max-md:w-[min(100%,280px)]"
            frameClassName="rounded-[20px]"
            {...reveal(2)}
          />
        </div>
        <p className="mt-6 text-sm/body text-muted-foreground">{s.note}</p>
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
  ...props
}: {
  lang: Lang;
  screen: Screen;
  copy: ScreenCopy;
  sizes: string;
  className?: string;
  frameClassName?: string;
} & ReturnType<typeof reveal>) {
  return (
    <figure className={cn("min-w-0", className)} {...props}>
      {/* Same treatment as the video: a thin border, no shadow. */}
      <div className={cn("overflow-hidden rounded-panel border border-border bg-card", frameClassName)}>
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
