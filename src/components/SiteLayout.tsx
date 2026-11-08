/**
 * HTML skeleton shared by both languages: theme script, font preloads, skip link, header, footer and the inquiry dialog.
 * / (English) and /zh/ (Chinese) each have a root layout (the two route groups under src/app) that only hands the language to this.
 */
import type { ReactNode } from "react";
import { preload } from "react-dom";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { Brand } from "./Brand";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { InquiryProvider } from "./InquiryDialog";
import { ThemeHead } from "./ThemeHead";
import "@/styles/global.css";

const fontOptions = { as: "font", type: "font/woff2", crossOrigin: "anonymous" } as const;

export function SiteLayout({ lang, children }: { lang: Lang; children: ReactNode }) {
  const { t, path } = useCopy(lang);
  const legalPage = (page: string) => {
    const { label } = t.legalPages.find(({ path: candidate }) => candidate === page)!;
    return { href: path(page), label };
  };
  preload("/fonts/Inter-Variable.woff2", fontOptions);
  preload("/fonts/BricolageGrotesque-Variable.woff2", fontOptions);

  return (
    // suppressHydrationWarning: theme-init.js rewrites data-theme and color-scheme on <html> before hydration.
    <html lang={t.htmlLang} data-scroll-behavior="smooth" suppressHydrationWarning>
      {/* This is the App Router root layout skeleton; it only lives under components/, so the path-based rule mistakes it for Pages Router. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <ThemeHead />
      </head>
      <body>
        <a
          className="fixed top-3 left-4 z-50 -translate-y-[160%] rounded-control bg-foreground px-3.5 py-2 text-background focus:translate-y-0"
          href="#main"
        >
          {t.skipLink}
        </a>
        <InquiryProvider
          lang={lang}
          copy={t.inquiry}
          dot={t.dot}
          products={t.services.products.map(({ name }) => name)}
          termsPage={legalPage("/terms/")}
          privacyPage={legalPage("/privacy/")}
        >
          <Header
            lang={lang}
            brand={<Brand lang={lang} />}
            copy={t.header}
            themeCopy={t.theme}
            langToggle={t.langToggle}
          />
          <main id="main">{children}</main>
          <Footer lang={lang} />
        </InquiryProvider>
      </body>
    </html>
  );
}
