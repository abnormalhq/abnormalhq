"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { linksFor, type Lang } from "@/data/site";
import { localePath, switchHref } from "@/i18n/paths";
import type { Copy } from "@/i18n/types";
import { Icon } from "./Icon";
import { ThemePicker } from "./ThemePicker";

export function Header({
  lang,
  brand,
  copy,
  themeCopy,
  langToggle,
}: {
  lang: Lang;
  /** Brand 是服务端组件，从布局传进来，避免把两种语言的文案打进浏览器脚本。 */
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
  const nav = copy.nav.map(({ anchor, label }) => ({ href: localePath(lang, `/#${anchor}`), label }));
  const other = lang === "zh" ? "en" : "zh";
  const otherHtmlLang = other === "en" ? "en" : "zh-CN";
  // 带 ?lang=：Worker 把这个选择写进三个站点共用的 cookie，之后分享来的链接也以这种语言打开（src/lib/lang.ts）。
  const otherPath = switchHref(pathname.endsWith("/") ? pathname : `${pathname}/`, other);

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
          {nav.map(({ href, label }) => (
            <Button asChild variant="ghost" className="border-0 px-2.5 font-normal max-nav:px-2" key={href}>
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {/* 两种语言各有一个根布局，切换时本来就是整页加载，而且要经过 Worker 写 cookie，不用 next/link。 */}
          <Button asChild variant="ghost" className="min-w-8 border-0 px-1.5 text-sm">
            <a
              href={otherPath}
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
          {/* 窄一点的平板宽度放不下全部入口：「我的账户」「登录邮箱」让给首屏与页脚的入口。 */}
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
            className="hidden size-9 max-md:inline-flex"
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
                {copy.loginWebmail} <Icon name="up-right" className="size-4" />
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
