import * as React from "react";
import { cn } from "@/lib/utils";

/** The lowercase "a" of the brand mark, drawn in the mark's 48×48 grid. */
const GLYPH_A =
  "M21.4 36 21.09 33.92Q20.26 35.01 19.14 35.59Q18.01 36.18 16.16 36.18Q14.38 36.18 13.09 35.58Q11.8 34.99 11.1 33.92Q10.4 32.85 10.4 31.41Q10.4 29.27 11.97 27.83Q13.55 26.39 16.62 26.05L21.09 25.55V24.25Q21.09 23.42 20.36 22.76Q19.63 22.09 18.08 22.09Q16.72 22.09 15.71 22.76Q14.71 23.42 14.37 24.74L11.03 23.51Q11.69 21.27 13.61 20.01Q15.52 18.76 18.28 18.76Q21.6 18.76 23.27 20.42Q24.93 22.08 24.93 24.67V36ZM21.09 28.52 16.99 29.04Q15.7 29.21 15.06 29.77Q14.41 30.34 14.41 31.17Q14.41 31.97 15.03 32.51Q15.65 33.06 16.76 33.06Q18.16 33.06 19.13 32.56Q20.1 32.07 20.59 31.11Q21.09 30.15 21.09 28.76Z";

/** The mark's arrow, in the mark's 48×48 grid: square caps and a mitered corner, unlike the round-capped interface icons. */
const ARROW = "M28 21 37.8 11.2M30.5 10H39v8.5";

/**
 * The abnormal mark: an ink "a" with a paper-white offset shadow and an upward arrow on a highlighter-yellow tile.
 * The colors are fixed brand colors, the same in both themes. The arrow stays inside a 21px radius of the center,
 * so circular crops (avatars, BIMI) keep it whole.
 */
function BrandMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      data-slot="brand-mark"
      className={cn("block size-8 shrink-0 overflow-hidden rounded-chip", className)}
      {...props}
    >
      <rect width="48" height="48" fill="#ffe14d" />
      <path d={GLYPH_A} fill="#f7f7f4" transform="translate(2.2 0)" />
      <path d={GLYPH_A} fill="#141412" />
      <path d={ARROW} fill="none" stroke="#141412" strokeWidth="3.2" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/**
 * Each product's glyph in a 20×20 box, drawn as the mark's arrow is: square caps, mitered corners, one stroke weight.
 * `lines` are drawn in paper, `accent` (strokes) and `accentFill` (shapes) in the highlighter, the product's one
 * yellow: the envelope's flap, the lit cell of the console's grid, the slash between the brackets, the status pulse,
 * the front window of Doppel, the play button of Take One.
 */
const PRODUCT_GLYPHS = {
  mail: { lines: ["M1 4H19V17H1Z"], accent: ["M2.2 5 10 11 17.8 5"], accentFill: [] },
  console: {
    lines: ["M1 1H8.5V8.5H1Z", "M1 11.5H8.5V19H1Z", "M11.5 11.5H19V19H11.5Z"],
    accent: [],
    accentFill: ["M11.5 1H19V8.5H11.5Z"],
  },
  developers: {
    lines: ["M6.5 3.5 1 10 6.5 16.5", "M13.5 3.5 19 10 13.5 16.5"],
    accent: ["M11.5 1.5 8.5 18.5"],
    accentFill: [],
  },
  status: { lines: [], accent: ["M0 11H5L8 3L12 18L15 11H20"], accentFill: [] },
  doppel: { lines: ["M6 6V1H19V14H14"], accent: ["M1 6H14V19H1Z"], accentFill: [] },
  takeone: { lines: ["M1 8H19V19H1Z", "M1 5.5 18 1"], accent: [], accentFill: ["M7.5 10.5 13.5 13.5 7.5 16.5Z"] },
} as const;

type Product = keyof typeof PRODUCT_GLYPHS;

/**
 * A product's own mark beside the abnormal mark: an ink tile, the product's glyph in paper lines and one stroke or
 * shape in the highlighter. The abnormal mark keeps the yellow tile; every product takes the ink one, so a row of
 * browser tabs tells them apart while the family stays one. Fixed brand colors, the same in both themes. The glyph
 * sits in the middle 22px of the 48px grid, inside a 21px radius of the center, so a round crop (a favicon, an avatar)
 * keeps it whole.
 */
function ProductMark({ product, className, ...props }: React.ComponentProps<"svg"> & { product: Product }) {
  const glyph = PRODUCT_GLYPHS[product];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      data-slot="product-mark"
      data-product={product}
      className={cn("block size-8 shrink-0 overflow-hidden rounded-chip", className)}
      {...props}
    >
      <rect width="48" height="48" fill="#141412" />
      <g
        transform="translate(13 13) scale(1.1)"
        fill="none"
        strokeWidth={3 / 1.1}
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {glyph.lines.map((d) => (
          <path key={d} d={d} stroke="#f7f7f4" />
        ))}
        {glyph.accent.map((d) => (
          <path key={d} d={d} stroke="#ffe14d" />
        ))}
        {glyph.accentFill.map((d) => (
          <path key={d} d={d} fill="#ffe14d" />
        ))}
      </g>
    </svg>
  );
}

/** The wordmark: "abnormal" with a signal-colored period. */
function BrandName({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="brand-name"
      // abnormal-allow: the lockup's own size, which follows neither the type scale nor the density.
      className={cn("font-heading text-[17px] leading-none font-semibold tracking-heading", className)}
      {...props}
    >
      abnormal<span className="text-signal">.</span>
    </span>
  );
}

/**
 * The arrow of the mark on its own, in the text color and at the size of the text: it ends a link that leaves for
 * another product or another site. Everything else keeps the interface icons.
 */
function BrandArrow({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      viewBox="24 6 18 18"
      data-slot="brand-arrow"
      className={cn("inline-block size-[0.875em] shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      {...props}
    >
      <path d={ARROW} />
    </svg>
  );
}

export { BrandArrow, BrandMark, BrandName, ProductMark };
export type { Product };
