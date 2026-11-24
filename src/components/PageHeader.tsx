import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, PageLead, PageTitle } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

/**
 * The top of an inner page (pricing, help, download, a document, a legal page): an eyebrow, the page's h1 on the registry's
 * page title scale, the lead and what the page puts right under it, such as the search or the current version, on a band
 * ruled off from the content. Every inner page opens the same way, so only the home page's stage is larger.
 * `before` sits above the eyebrow (a breadcrumb), and `aside` beside the title on wide screens (a legal page's dates).
 */
export function PageHeader({
  id,
  eyebrow,
  title,
  dot,
  lead,
  before,
  aside,
  children,
  className,
}: {
  /** The h1's id, which the page's section is labelled by. */
  id: string;
  /** Decorative English label above the title. */
  eyebrow: string;
  title: ReactNode;
  /** The language's full stop, in the signal color after the title. */
  dot: string;
  lead?: ReactNode;
  before?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <Container className="py-12 md:py-16">
        {before}
        <div
          className={cn(
            before && "mt-8 md:mt-10",
            aside && "flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-14",
          )}
        >
          <div className="max-w-192 min-w-0">
            <Eyebrow lang="en">{eyebrow}</Eyebrow>
            <PageTitle id={id}>
              {title}
              <HeadingMark>{dot}</HeadingMark>
            </PageTitle>
            {lead && <PageLead>{lead}</PageLead>}
            {children}
          </div>
          {aside}
        </div>
      </Container>
    </div>
  );
}
