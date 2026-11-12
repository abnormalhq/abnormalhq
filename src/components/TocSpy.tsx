"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { currentSection } from "@/lib/toc";

/**
 * Wraps a table of contents of in-page links and marks the link of the section being read with aria-current="location",
 * which the links style. The table of contents itself is prerendered; without JavaScript it simply marks nothing.
 */
export function TocSpy({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const links = [...(root.current?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])];
    const targets = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))));
    if (links.length === 0 || targets.some((target) => !target)) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // A heading counts as reached a little below the sticky header (html's scroll-padding-top is 5rem).
      const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + 32 || 112;
      const page = document.documentElement;
      const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= page.scrollHeight - 2;
      const index = currentSection(
        targets.map((target) => target!.getBoundingClientRect().top),
        offset,
        atBottom,
      );
      links.forEach((link, i) => {
        if (i === index) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className="contents" ref={root}>
      {children}
    </div>
  );
}
