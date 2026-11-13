/**
 * IndexNow (https://www.indexnow.org/): after each production deploy, scripts/indexnow.ts tells the search engines that take it
 * (Bing, which also answers ChatGPT search and Copilot, and Yandex, Naver, Seznam and others) which addresses to crawl again,
 * instead of waiting for them to come back on their own. Google and Baidu do not take IndexNow and read the sitemap.
 *
 * The key proves the site is ours: it is served as plain text at keyLocation (public/<key>.txt), and is public by design.
 * Changing it means renaming that file to the new key in the same commit.
 */
import { site } from "../data/site.ts";
import { pages } from "./pages.ts";

export const indexNowKey = "92d5167e39648bbd65623cd32ea20faa";
export const indexNowEndpoint = "https://api.indexnow.org/indexnow";

/** The request body: every page in the sitemap, in both languages (src/lib/pages.ts). Session pages are noindex and not sent. */
export function indexNowRequest() {
  const { host } = new URL(site.url);
  return {
    host,
    key: indexNowKey,
    keyLocation: `${site.url}/${indexNowKey}.txt`,
    urlList: pages.map((page) => `${site.url}${page.url}`),
  };
}
