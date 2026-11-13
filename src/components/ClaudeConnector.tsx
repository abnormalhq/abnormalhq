import Link from "next/link";
import { TextLink } from "@/components/ui/text-link";
import { claudeContent } from "@/content/claude";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { claudeStructuredData } from "@/lib/structured-data";
import { DocArticle } from "./DocArticle";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";

/**
 * The Claude connector page (/claude/, /zh/claude/): how an administrator connects Claude to the admin console's MCP server,
 * what the consent page asks, the tools, how to disconnect, and what is kept, in the help articles' layout. The text is
 * src/content/claude/, written only from what mail's documentation and the privacy policy back up.
 */
export function ClaudeConnector({ lang }: { lang: Lang }) {
  const { t, path } = useCopy(lang);
  const c = t.claude;
  const content = claudeContent[lang];
  // A fixed date from the content, not the clock: the page is prerendered.
  const reviewed = new Intl.DateTimeFormat(t.legal.dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${content.reviewed}T00:00:00Z`),
  );
  return (
    <>
      <JsonLd data={claudeStructuredData(lang)} />
      <DocArticle
        lang={lang}
        eyebrow={c.eyebrow}
        title={content.title}
        summary={content.summary}
        trail={[]}
        crumb={c.navLabel}
        sections={content.sections}
        meta={
          <>
            {c.reviewedLabel}
            {t.legal.colon}
            <time dateTime={content.reviewed}>{reviewed}</time>
          </>
        }
      >
        <nav
          className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-7"
          aria-label={t.legal.relatedLabel}
        >
          <TextLink asChild>
            <Link href={path("/privacy/")}>
              {c.policyLink} <Icon name="up-right" className="size-4" />
            </Link>
          </TextLink>
          <TextLink asChild>
            <Link href={path("/security/")}>
              {c.securityLink} <Icon name="arrow" className="size-4" />
            </Link>
          </TextLink>
        </nav>
      </DocArticle>
    </>
  );
}
