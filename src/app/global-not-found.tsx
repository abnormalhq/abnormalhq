import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ThemeHead } from "@/components/ThemeHead";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow, HeadingMark, SectionTitle, sectionSpaceClassName } from "@/components/ui/section-heading";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "Page not found · 页面不存在 — Abnormal",
  robots: { index: false },
};

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
          </main>
        </Container>
      </body>
    </html>
  );
}
