import type { DocImage } from "@/content/help/types";
import type { Lang } from "@/data/site";
import { cn } from "@/lib/utils";
import { RichText } from "./RichText";
import { ThemedImage } from "./ThemedImage";

/**
 * Local, pre-sized assets: the Worker does not have an image optimization service. A screenshot with a dark version shows the one of
 * the page's theme, and "View full size" opens that one (ThemedImage: the other is not displayed, so not fetched either).
 */
export function DocFigure({ image, base, lang }: { image: DocImage; base: string; lang: Lang }) {
  const view = lang === "zh" ? "查看原图（在新标签页打开）" : "View full-size image (opens in a new tab)";
  const original = (className?: string, href = image.src) => (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={view}>
      {lang === "zh" ? "查看原图" : "View full size"} <span aria-hidden="true">↗</span>
    </a>
  );
  return (
    <figure className="my-7 min-w-0">
      <a
        href={image.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${image.alt} — ${view}`}
        className={cn(
          "block overflow-hidden rounded-panel border border-border outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring",
          // abnormal-allow: the drawings and a screenshot without a dark version are light pages, so their frame stays white in the dark theme too.
          image.dark ? "bg-card dark:hidden" : "bg-white",
        )}
      >
        <ThemedImage
          light={{ src: image.src, srcSet: image.srcSet }}
          sizes={image.srcSet ? "(min-width: 1024px) 736px, calc(100vw - 32px)" : undefined}
          width={image.width}
          height={image.height}
          alt={image.alt}
          decoding="async"
          className="block h-auto w-full"
        />
      </a>
      {image.dark && (
        <a
          href={image.dark.src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${image.alt} — ${view}`}
          className="hidden overflow-hidden rounded-panel border border-border bg-card outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring dark:block"
        >
          <ThemedImage
            light={image.dark}
            sizes="(min-width: 1024px) 736px, calc(100vw - 32px)"
            width={image.width}
            height={image.height}
            alt={image.alt}
            decoding="async"
            className="block h-auto w-full"
          />
        </a>
      )}
      <figcaption className="mt-3 text-sm/[1.65] text-muted-foreground">
        <RichText text={image.caption} base={base} code />{" "}
        {image.dark ? (
          <>
            {original("dark:hidden")}
            {original("hidden dark:inline", image.dark.src)}
          </>
        ) : (
          original()
        )}
      </figcaption>
    </figure>
  );
}
