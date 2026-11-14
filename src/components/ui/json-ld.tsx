import * as React from "react";

/**
 * Structured data as JSON text that is safe inside a <script>: every "<" is written as <, which JSON reads back
 * as the same character, so a value holding "</script>" or "<!--" cannot end the element or open a comment.
 */
function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * The structured data of a page (schema.org JSON-LD) for search engines and other readers: a native
 * <script type="application/ld+json">, rendered on the server with the page. It is data, not a script to run, so it
 * needs no loader such as next/script, and a Content Security Policy does not ask for its nonce (pass one anyway with
 * `nonce` if the page's policy is written that way). `data` is any value JSON can hold, usually an object with
 * "@context" and "@type", or an array of them; the text is escaped by serializeJsonLd.
 */
function JsonLd({
  data,
  ...props
}: Omit<React.ComponentProps<"script">, "children" | "dangerouslySetInnerHTML" | "type" | "src"> & {
  /** The structured data, such as { "@context": "https://schema.org", "@type": "Organization", … }. */
  data: unknown;
}) {
  return (
    <script
      type="application/ld+json"
      data-slot="json-ld"
      {...props}
      // The only way to put text in a script element that React will not escape into entities; the text is escaped
      // above, for the script element, instead.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export { JsonLd, serializeJsonLd };
