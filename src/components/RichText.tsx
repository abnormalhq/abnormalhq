import type { ReactNode } from "react";
import { TextLink } from "@/components/ui/text-link";

/** The two markup forms in copy: **bold** and [text](link). */
const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
/** The same, plus `inline code`: only the developer documentation writes backticks (see the `code` prop). */
const TOKEN_WITH_CODE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/g;

interface Props {
  text: string;
  /** Language root prepended to site-relative paths (no protocol, not mailto:, not starting with #), e.g. / or /en/. */
  base?: string;
  /** Draw the links as the registry's inline TextLink; leave it off where the surrounding styles (Prose) draw them. */
  inlineLinks?: boolean;
  /** Also render `inline code` as <code>. Off by default, so a backtick in shop copy stays a backtick. */
  code?: boolean;
}

function resolve(href: string, base: string): string {
  return /^(https?:|mailto:|#)/.test(href) ? href : `${base}${href}`;
}

/** Renders one line of marked-up copy as text, <strong> and <a>; external links open in a new tab so readers stay in the guide. */
export function RichText({ text, base = "/", inlineLinks = false, code = false }: Props) {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(code ? TOKEN_WITH_CODE : TOKEN)) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    const [token, bold, label, href, literal] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={index}>{bold}</strong>);
    } else if (literal !== undefined) {
      nodes.push(<code key={index}>{literal}</code>);
    } else {
      const external = /^https?:/.test(href!);
      const link = {
        href: resolve(href!, base),
        target: external ? "_blank" : undefined,
        rel: external ? "noopener noreferrer" : undefined,
      };
      nodes.push(
        inlineLinks ? (
          <TextLink variant="inline" key={index} {...link}>
            {label}
          </TextLink>
        ) : (
          <a key={index} {...link}>
            {label}
          </a>
        ),
      );
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
