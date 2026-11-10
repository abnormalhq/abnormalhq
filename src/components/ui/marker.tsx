import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A stroke of the highlighter under a number or a single word: a band of yellow across the lower half of the text,
 * which keeps its own color. Where the text is light (dark mode, or inside the ink shell on any page) the band is the
 * soft yellow, so the text still reads on it.
 * For one number or one word, never a sentence, and once on a screen.
 */
function Marker({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker"
      className={cn(
        "bg-[linear-gradient(transparent_56%,var(--marker-band)_56%_90%,transparent_90%)] box-decoration-clone px-[0.06em] [--marker-band:var(--highlight)] dark:[--marker-band:var(--highlight-muted)] [.ink_&]:[--marker-band:var(--highlight-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export { Marker };
