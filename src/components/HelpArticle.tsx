import Link from "next/link";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { helpArticles, helpContent, helpPath, type HelpArticle as Article } from "@/content/help";
import { site, type Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { helpArticleStructuredData } from "@/lib/structured-data";
import { fillTemplate } from "@/lib/template";
import { DocArticle } from "./DocArticle";
import { Icon } from "./Icon";
import { JsonLd } from "./JsonLd";

/** At most this many related articles under an article; a topic has up to five. */
const RELATED_MAX = 3;

/** One help article (/help/<slug>/): the article, then the way back to the index and on to support. */
export function HelpArticle({ lang, article }: { lang: Lang; article: Article }) {
  const { t, path } = useCopy(lang);
  const h = t.help;
  const email = site.contact.email.trim();
  // The other articles of the same topic, in the index's order: where a reader who finished this one most likely goes next.
  const topic = helpContent[lang].categories[article.category];
  const related = helpArticles(lang)
    .filter((entry) => entry.category === article.category && entry.slug !== article.slug)
    .slice(0, RELATED_MAX);
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
        {related.length > 0 && (
          <nav className="mt-14" aria-labelledby="help-related-title">
            <h2 className="text-lg/[1.5] font-semibold" id="help-related-title">
              {fillTemplate(h.related, { topic }).join("")}
            </h2>
            <ul className="mt-3 border-t border-border">
              {related.map((entry) => (
                <li className="border-b border-border" key={entry.slug}>
                  <Link className="group/entry flex items-start gap-4 py-4" href={path(helpPath(entry.slug))}>
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
          </nav>
        )}
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
