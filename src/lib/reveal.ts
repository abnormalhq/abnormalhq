import type { CSSProperties } from "react";

/** The delay between neighbours that scroll into view together, so a row of cards arrives one after another. */
const STEP_MS = 70;

/**
 * Props that mark an element to rise into view the first time it is scrolled to (see ScrollReveal and the
 * [data-reveal] rules in global.css). `step` is the element's place among its siblings: each step starts a little later.
 * Spread it onto the element: `<li {...reveal(index)}>`.
 */
export function reveal(step = 0): { "data-reveal": ""; style?: CSSProperties } {
  if (step <= 0) return { "data-reveal": "" };
  return { "data-reveal": "", style: { "--reveal-delay": `${step * STEP_MS}ms` } as CSSProperties };
}
