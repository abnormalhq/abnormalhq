import * as React from "react";
import { encode } from "uqr";
import { cn } from "@/lib/utils";

/**
 * A QR code for a link, an address or a setup key, drawn as inline SVG on the server: the value never goes to an
 * outside service and the page needs no script. The modules come from uqr's encoder, merged into one path.
 * It is dark modules on white with the four-module quiet zone scanners need, in the dark theme too: not every
 * scanner or wallet reads a light-on-dark code, so the code keeps its own white instead of the page's colors.
 * It is an image named by `label`, in the page's language ("QR code for the wallet address"); give the value as
 * text beside it as well, for anyone who cannot scan. `level` is the error correction, from L (7% of the code can be
 * lost) to H (30%); M suits a screen.
 */
function QrCode({
  value,
  label,
  level = "M",
  className,
  ...props
}: Omit<React.ComponentProps<"svg">, "children" | "role" | "aria-label" | "viewBox"> & {
  /** What the code holds. */
  value: string;
  /** The image's accessible name. */
  label: string;
  level?: "L" | "M" | "Q" | "H";
}) {
  const qr = encode(value, { ecc: level, border: 4 });
  let path = "";
  qr.data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg
      data-slot="qr-code"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      shapeRendering="crispEdges"
      className={cn("block size-44 rounded-control border border-border", className)}
      {...props}
    >
      {/* A scanner needs dark modules on a light quiet zone in either theme, so these two stay black and white. */}
      {/* abnormal-allow: see above */}
      <rect width={qr.size} height={qr.size} className="fill-white" />
      {/* abnormal-allow: see above */}
      <path d={path} className="fill-black" />
    </svg>
  );
}

export { QrCode };
