"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type SyntheticEvent } from "react";
import { BrandArrow } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { linksFor, type Lang } from "@/data/site";
import { localePath, switchHref } from "@/i18n/paths";
import type { Copy } from "@/i18n/types";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ThemePicker } from "./ThemePicker";

/** The query string of the current address; history changes outside Next.js's router (back / forward) re-render the header. */
function readSearch(): string {
  return window.location.search;
}

function subscribeToHistory(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function Header({
  lang,
  brand,
  copy,
  themeCopy,
  langToggle,
}: {
  lang: Lang;
  /** Brand is a server component passed in from the layout, so both languages' copy stays out of the browser bundle. */
  brand: ReactNode;
  copy: Copy["header"];
  themeCopy: Copy["theme"];
  langToggle: Copy["langToggle"];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const closeMenu = () => setMenuOpen(false);

  const links = linksFor(lang);
  // An entry is a section of the home page (anchor) or a page of its own (path), such as the pricing page.
  const nav = copy.nav.map(({ anchor, path, label, wide }) => ({
    href: localePath(lang, path ?? `/#${anchor}`),
    label,
    wide,
  }));
  const other = lang === "zh" ? "en" : "zh";
  const otherHtmlLang = other === "en" ? "en" : "zh-CN";
  // With ?lang=: the Worker stores the choice in the cookie shared by the three sites, so shared links open in this language from then on (src/lib/lang.ts).
  // The storefront's order, renewal and account pages carry their query string (order number, tokens) across; see switchHref.
  // Prerendering has no query string; after hydration the link carries it, so opening it in a new tab keeps it too.
  const search = useSyncExternalStore(subscribeToHistory, readSearch, () => "");
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const otherPath = switchHref(normalizedPath, other, search);
  // Client-side changes of the query string on the same page do not re-render the header; read it afresh right before the link is used.
  const refreshOtherPath = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.currentTarget.href = switchHref(normalizedPath, other, window.location.search);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggle.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const onDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    desktop.addEventListener("change", onDesktopChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
      desktop.removeEventListener("change", onDesktopChange);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background" ref={header}>
      <Container className="flex min-h-16 items-center justify-between gap-6 max-md:gap-3">
        {brand}
        <nav className="mr-auto ml-6 flex items-center gap-1 max-nav:ml-2 max-md:hidden" aria-label={copy.navLabel}>
          {nav.map(({ href, label, wide }) => (
            <Button
              asChild
              variant="ghost"
              className={cn(
                "border-0 px-2.5 font-normal max-nav:px-2",
                wide === "card" && "max-card:hidden",
                wide === "bar" && "max-bar:hidden",
              )}
              key={href}
            >
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {/* Each language has its own root layout, so switching is a full page load anyway, and it has to pass through the Worker to write the cookie; no need for next/link. */}
          <Button asChild variant="ghost" className="min-w-8 border-0 px-1.5 text-sm">
            <a
              href={otherPath}
              onPointerDown={refreshOtherPath}
              onClick={refreshOtherPath}
              onContextMenu={refreshOtherPath}
              onFocus={refreshOtherPath}
              hrefLang={otherHtmlLang}
              lang={otherHtmlLang}
              aria-label={langToggle.aria}
              title={langToggle.aria}
            >
              {langToggle.label}
            </a>
          </Button>
          <ThemePicker copy={themeCopy} onOpen={closeMenu} />
          <span className="mx-2 h-4 w-px bg-border max-md:hidden" aria-hidden="true"></span>
          {/* Narrower tablet widths cannot fit every entry: "My account" and "Log in" give way to the entries in the hero and footer. */}
          <Button asChild variant="ghost" className="border-0 px-2.5 font-normal max-nav:hidden">
            <a href={links.account}>{copy.account}</a>
          </Button>
          <Button asChild variant="ghost" className="mr-1 border-0 px-2.5 font-normal max-nav:hidden">
            <a href={links.webmail}>{copy.login}</a>
          </Button>
          <Button asChild className="max-md:hidden">
            <a href={links.shop}>
              {copy.buy} <Icon name="up-right" className="size-3.5" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden max-md:inline-flex"
            type="button"
            ref={toggle}
            aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name="menu" />
          </Button>
        </div>
      </Container>
      <nav
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-65px)] overflow-y-auto overscroll-contain border-b border-border bg-background md:hidden"
        id="mobile-nav"
        aria-label={copy.mobileNavLabel}
        hidden={!menuOpen}
      >
        <Container className="flex flex-col pt-2 pb-5">
          {nav.map(({ href, label }, index) => (
            <Link
              className="flex min-h-[52px] items-center gap-3.5 border-b border-border text-md/body"
              href={href}
              key={href}
              onClick={closeMenu}
            >
              <span className="text-xs/body text-muted-foreground">0{index + 1}</span>
              {label}
              <Icon name="up-right" className="ml-auto size-4 text-muted-foreground" />
            </Link>
          ))}
          <div className="mt-4 grid gap-2">
            <Button asChild size="lg">
              <a href={links.shop} onClick={closeMenu}>
                {copy.buy} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={links.account} onClick={closeMenu}>
                {copy.account} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={links.webmail} onClick={closeMenu}>
                {copy.loginWebmail} <BrandArrow className="size-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href={links.redeem} onClick={closeMenu}>
                {copy.haveCode} <Icon name="up-right" className="size-4" />
              </a>
            </Button>
          </div>
        </Container>
      </nav>
    </header>
  );
}
