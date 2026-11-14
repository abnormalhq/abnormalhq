import type { ReactNode } from "react";
import { Toc, TocLink, TocList, TocTitle } from "@/components/ui/toc";

/**
 * The table of contents beside a help article, the security overview, the Claude connector page and the legal documents: the
 * registry's Toc, which marks the section being read. Beside the document it is the registry's list on a hairline; above it, on
 * a narrow screen, the sections wrap as chips, so the article is not pushed a screen down.
 */
export function SectionToc({
  label,
  title,
  sections,
}: {
  /** The landmark's name. */
  label: string;
  /** The visible heading above the list. */
  title: ReactNode;
  sections: readonly { id: string; text: ReactNode }[];
}) {
  return (
    <Toc label={label}>
      <TocTitle className="mb-4 text-sm/body">{title}</TocTitle>
      <TocList className="max-lg:flex-row max-lg:flex-wrap max-lg:gap-2 max-lg:border-l-0">
        {sections.map(({ id, text }, index) => (
          <TocLink
            className="flex items-baseline gap-[0.65rem] text-sm/[1.6] max-lg:ml-0 max-lg:rounded-control max-lg:border max-lg:border-input max-lg:bg-control max-lg:px-[0.85rem] max-lg:py-[0.6rem] max-lg:hover:bg-accent max-lg:aria-[current=location]:border-input max-lg:aria-[current=location]:font-normal"
            href={`#${id}`}
            key={id}
          >
            <span className="shrink-0 text-[11px] text-muted-foreground" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {text}
          </TocLink>
        ))}
      </TocList>
    </Toc>
  );
}
