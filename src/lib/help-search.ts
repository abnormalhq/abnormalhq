/**
 * The help center's search-as-you-type (src/components/HelpSearch.tsx): a plain substring match over each article's title,
 * summary and keywords, in the browser, with no index and no dependency. Fourteen articles need nothing more, and the
 * prerendered page lists them all, so the page works without JavaScript and the search only narrows it.
 * Kept free of the content modules, so the browser bundle carries only the entries of the page's own language (through props).
 */

export interface HelpSearchEntry {
  href: string;
  title: string;
  summary: string;
  keywords: readonly string[];
}

/** Lower-case, full-width forms folded to ASCII (Chinese input methods type full-width letters and digits), spaces collapsed. */
export function normalizeQuery(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The words of a query. Chinese is written without spaces, so a Chinese query is one word and matches as a substring. */
export function queryWords(query: string): string[] {
  const normalized = normalizeQuery(query);
  return normalized ? normalized.split(" ") : [];
}

/** An entry matches when every word of the query occurs in its title, summary or keywords. An empty query matches everything. */
export function matchesQuery(entry: HelpSearchEntry, query: string): boolean {
  const words = queryWords(query);
  if (words.length === 0) return true;
  const haystack = normalizeQuery([entry.title, entry.summary, ...entry.keywords].join(" "));
  return words.every((word) => haystack.includes(word));
}
