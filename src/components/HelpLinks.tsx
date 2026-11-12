import Link from "next/link";
import { Icon } from "./Icon";

/**
 * A short list of help articles under a heading: the related articles at the foot of an article, and the billing questions on
 * the pricing page. Hairline rows like the help center's index, title and summary, the whole row a link.
 */
export function HelpLinks({
  id,
  title,
  entries,
  className,
  children,
}: {
  /** id of the heading, which names the list's landmark. */
  id: string;
  title: string;
  entries: readonly { href: string; title: string; summary: string }[];
  className?: string;
  /** Below the list, such as a link on to every article. */
  children?: React.ReactNode;
}) {
  return (
    <nav className={className} aria-labelledby={id}>
      <h2 className="text-lg/[1.5] font-semibold" id={id}>
        {title}
      </h2>
      <ul className="mt-3 border-t border-border">
        {entries.map((entry) => (
          <li className="border-b border-border" key={entry.href}>
            <Link className="group/entry flex items-start gap-4 py-4" href={entry.href}>
              <span className="min-w-0 flex-1">
                <span className="block text-base/[1.5] font-medium underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 group-hover/entry:decoration-current">
                  {entry.title}
                </span>
                <span className="mt-1 block text-sm/[1.6] text-muted-foreground">{entry.summary}</span>
              </span>
              <Icon
                name="arrow"
                className="mt-1 size-4 text-muted-foreground transition-colors duration-150 group-hover/entry:text-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </nav>
  );
}
