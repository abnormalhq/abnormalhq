import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticle } from "@/components/HelpArticle";
import { helpArticle, helpPath, helpSlugOf, helpSlugs } from "@/content/help";
import { pageMetadata } from "@/lib/metadata";

// One page per article in src/content/help/, all prerendered; any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return helpSlugs.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = helpSlugOf(`/help/${(await params).slug}/`);
  if (!slug) return {};
  const article = helpArticle("zh", slug);
  return pageMetadata({
    lang: "zh",
    path: helpPath(slug),
    title: `${article.title} — Abnormal`,
    description: article.summary,
  });
}

export default async function ZhHelpArticlePage({ params }: Props) {
  const slug = helpSlugOf(`/help/${(await params).slug}/`);
  if (!slug) notFound();
  return <HelpArticle lang="zh" article={helpArticle("zh", slug)} />;
}
