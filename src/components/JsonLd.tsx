import { serializeJsonLd } from "@/lib/structured-data";

/** Structured data is data, not a script, so this uses a native <script> rather than next/script. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
