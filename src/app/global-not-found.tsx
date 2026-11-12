import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ThemeHead } from "@/components/ThemeHead";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "Page not found · 页面不存在 — Abnormal",
  robots: { index: false },
};

/** Where a lost visitor most likely meant to go, English first then Chinese, like the rest of this page. */
const notFoundLinks = [
  { href: "/help/", label: "Help center", lang: "en" },
  { href: "/zh/help/", label: "帮助中心", lang: "zh" },
  { href: "/pricing/", label: "Plans and prices", lang: "en" },
  { href: "/zh/pricing/", label: "套餐与价格", lang: "zh" },
] as const;

/** The 404 shared by the English and Chinese root layouts: static hosting has a single 404.html, so both languages are written together, with the default language (English) first. */
export default function GlobalNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeHead />
      </head>
      <body>
        <Container asChild className={sectionSpaceClassName}>
          <main>
            <Eyebrow lang="en">404 / Page not found</Eyebrow>
            <SectionTitle asChild>
              <h1>
                This page doesn&apos;t exist<HeadingMark>.</HeadingMark>
              </h1>
            </SectionTitle>
            <p lang="zh-CN" className="mt-3 text-muted-foreground">
              这个页面不存在。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/">
                  Back to home <Icon name="arrow" className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/zh/" hrefLang="zh-CN" lang="zh-CN">
                  返回首页 <Icon name="arrow" className="size-4" />
                </Link>
              </Button>
            </div>
            {/* A mistyped or outdated link often meant a help article or the plans: offer both, in both languages. */}
            <nav className="mt-10 border-t border-border pt-6 text-sm/body" aria-label="Popular pages · 常用页面">
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 sm:max-w-md">
                {notFoundLinks.map(({ href, label, lang }) => (
                  <li key={href}>
                    <TextLink asChild>
                      <Link
                        href={href}
                        lang={lang === "zh" ? "zh-CN" : undefined}
                        hrefLang={lang === "zh" ? "zh-CN" : undefined}
                      >
                        {label} <Icon name="arrow" className="size-3.5" />
                      </Link>
                    </TextLink>
                  </li>
                ))}
              </ul>
            </nav>
          </main>
        </Container>
      </body>
    </html>
  );
}
