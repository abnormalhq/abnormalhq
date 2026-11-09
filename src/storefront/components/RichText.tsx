import type { ReactNode } from "react";

/** The two markup forms in copy: **bold** and [text](link). */
const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Links in body text: ink colour with a faint underline that darkens on hover. */
export const inlineLinkClass =
  "text-foreground underline decoration-border underline-offset-4 hover:decoration-current";

interface Props {
  text: string;
  /** Language root prepended to site-relative paths (no protocol, not mailto:, not starting with #), e.g. / or /en/. */
  base?: string;
  linkClassName?: string;
}

function resolve(href: string, base: string): string {
  return /^(https?:|mailto:|#)/.test(href) ? href : `${base}${href}`;
}

/** Renders one line of marked-up copy as text, <strong> and <a>; external links open in a new tab so readers stay in the guide. */
export function RichText({ text, base = "/", linkClassName }: Props) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    const [token, bold, label, href] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={index}>{bold}</strong>);
    } else {
      const external = /^https?:/.test(href!);
      nodes.push(
        <a
          key={index}
          className={linkClassName}
          href={resolve(href!, base)}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {label}
        </a>,
      );
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
