import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import type { HelpArticle as Article } from "@/content/help";
import { site, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { helpArticleStructuredData } from "@/lib/structured-data";
import { DocArticle } from "./DocArticle";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";

/** One help article (/help/<slug>/): the article, then the way back to the index and on to support. */
export function HelpArticle({ lang, article }: { lang: Lang; article: Article }) {
  const { t, path } = useCopy(lang);
  const h = t.help;
  const email = site.contact.email.trim();
  return (
    <>
      <JsonLd data={helpArticleStructuredData(lang, article)} />
      <DocArticle
        lang={lang}
        eyebrow={h.articleEyebrow}
        title={article.title}
        summary={article.summary}
        trail={[{ label: h.navLabel, path: "/help/" }]}
        sections={article.sections}
      >
        <Card asChild className="mt-14 block p-[1.4rem] md:px-8 md:py-7">
          <aside aria-labelledby="help-wrong-title">
            <h2 className="text-lg/[1.5] font-semibold" id="help-wrong-title">
              {h.wrong.title}
            </h2>
            <p className="mt-2 text-base/prose text-muted-foreground">{h.wrong.body}</p>
            <p className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <TextLink asChild>
                <Link href={path("/help/")}>
                  {h.wrong.index} <Icon name="arrow" className="size-4" />
                </Link>
              </TextLink>
              {email && (
                <TextLink href={`mailto:${email}`}>
                  {h.wrong.contact} <Icon name="up-right" className="size-4" />
                </TextLink>
              )}
            </p>
          </aside>
        </Card>
      </DocArticle>
    </>
  );
}
