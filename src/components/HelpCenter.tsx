import { TextLink } from "@/components/ui/text-link";
import { helpArticles, helpCategoryIds, helpContent, helpPath } from "@/content/help";
import { site, type Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { helpIndexStructuredData } from "@/lib/structured-data";
import { HelpSearch } from "./HelpSearch";
import { Icon } from "./Icon";
import { JsonLd } from "@/components/ui/json-ld";

/**
 * The help center's index (/help/, /zh/help/): every article by topic, with search-as-you-type. The list is prerendered whole
 * and HelpSearch, a client component, gets only this language's titles, summaries and keywords through props.
 */
export function HelpCenter({ lang }: { lang: Lang }) {
  const { t, path } = getCopy(lang);
  const h = t.help;
  const { categories } = helpContent[lang];
  const articles = helpArticles(lang);
  const email = site.contact.email.trim();
  const groups = helpCategoryIds.map((category) => ({
    id: category,
    title: categories[category],
    entries: articles
      .filter((article) => article.category === category)
      .map(({ slug, title, summary, keywords }) => ({ href: path(helpPath(slug)), title, summary, keywords })),
  }));

  return (
    <>
      <JsonLd data={helpIndexStructuredData(lang)} />
      <section aria-labelledby="help-title">
        <HelpSearch
          copy={h.search}
          groups={groups}
          header={{ id: "help-title", eyebrow: h.eyebrow, title: h.title, dot: t.dot, lead: h.intro }}
        >
          <div className="mt-14 border-t border-border pt-8">
            <h2 className="text-lg/normal font-semibold">{h.ask.title}</h2>
            <p className="mt-2 max-w-2xl text-base/prose text-muted-foreground">{h.ask.body}</p>
            {email && (
              <TextLink className="mt-4" href={`mailto:${email}`}>
                {h.wrong.contact} <Icon name="up-right" className="size-4" />
              </TextLink>
            )}
          </div>
        </HelpSearch>
      </section>
    </>
  );
}
