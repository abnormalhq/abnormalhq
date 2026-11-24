import type { DocImage } from "@/content/help/types";
import type { Lang } from "@/data/site";
import { RichText } from "./RichText";

/** Local, pre-sized assets: the Worker does not have an image optimization service. */
export function DocFigure({ image, base, lang }: { image: DocImage; base: string; lang: Lang }) {
  const view = lang === "zh" ? "查看原图（在新标签页打开）" : "View full-size image (opens in a new tab)";
  return (
    <figure className="my-7 min-w-0">
      <a
        href={image.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${image.alt} — ${view}`}
        // abnormal-allow: the screenshots are light pages, so their frame stays white in the dark theme too.
        className="block overflow-hidden rounded-panel border border-border bg-white outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          srcSet={image.srcSet}
          sizes={image.srcSet ? "(min-width: 1024px) 736px, calc(100vw - 32px)" : undefined}
          width={image.width}
          height={image.height}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </a>
      <figcaption className="mt-3 text-sm/[1.65] text-muted-foreground">
        <RichText text={image.caption} base={base} code />{" "}
        <a href={image.src} target="_blank" rel="noopener noreferrer" aria-label={view}>
          {lang === "zh" ? "查看原图" : "View full size"} <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
    </figure>
  );
}
