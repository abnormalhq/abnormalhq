import Link from "next/link";
import { TextLink } from "@/components/ui/text-link";
import { securityContent } from "@/content/security";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { securityStructuredData } from "@/lib/structured-data";
import { DocArticle } from "./DocArticle";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";

/**
 * The security and privacy overview (/security/, /zh/security/): what protects a mailbox, what is not offered, where data is
 * processed and how to report a problem, in the help articles' layout. The text is src/content/security/, written only from
 * what the privacy policy and mail's documentation back up.
 */
export function SecurityOverview({ lang }: { lang: Lang }) {
  const { t, path } = useCopy(lang);
  const s = t.security;
  const content = securityContent[lang];
  // A fixed date from the content, not the clock: the page is prerendered.
  const reviewed = new Intl.DateTimeFormat(t.legal.dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${content.reviewed}T00:00:00Z`),
  );
  return (
    <>
      <JsonLd data={securityStructuredData(lang)} />
      <DocArticle
        lang={lang}
        eyebrow={s.eyebrow}
        title={content.title}
        summary={content.summary}
        trail={[]}
        crumb={s.navLabel}
        sections={content.sections}
        meta={
          <>
            {s.reviewedLabel}
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
              {s.policyLink} <Icon name="up-right" className="size-4" />
            </Link>
          </TextLink>
          <TextLink asChild>
            <Link href={path("/help/")}>
              {s.helpLink} <Icon name="arrow" className="size-4" />
            </Link>
          </TextLink>
        </nav>
      </DocArticle>
    </>
  );
}
