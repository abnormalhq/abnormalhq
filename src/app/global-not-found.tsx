import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { ThemeScript } from "@/components/ui/theme-script";
import {
  NotFound,
  NotFoundActions,
  NotFoundAside,
  NotFoundCode,
  NotFoundDescription,
  NotFoundTitle,
} from "@/components/ui/not-found";

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
        <ThemeScript />
      </head>
      <body>
        <NotFound className="min-h-svh">
          <NotFoundCode lang="en">404 · Page not found</NotFoundCode>
          <NotFoundTitle>This page doesn&apos;t exist.</NotFoundTitle>
          <NotFoundDescription>The link may be old, or the address mistyped.</NotFoundDescription>
          <NotFoundActions>
            <Button asChild size="lg">
              <Link href="/">
                Back to home <Icon name="arrow" className="size-4" />
              </Link>
            </Button>
          </NotFoundActions>
          <NotFoundAside lang="zh-CN">
            <h2 className="font-medium text-foreground">这个页面不存在。</h2>
            <p className="mt-1">链接可能已经过期，或者地址输错了。</p>
            <p className="mt-3">
              <TextLink asChild>
                <Link href="/zh/" hrefLang="zh-CN">
                  返回首页 <Icon name="arrow" className="size-3.5" />
                </Link>
              </TextLink>
            </p>
          </NotFoundAside>
          {/* A mistyped or outdated link often meant a help article or the plans: offer both, in both languages. */}
          <nav className="mt-6 text-sm/body" aria-label="Popular pages · 常用页面">
            <ul className="grid gap-x-8 gap-y-3 sm:max-w-md sm:grid-cols-2">
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
        </NotFound>
      </body>
    </html>
  );
}
