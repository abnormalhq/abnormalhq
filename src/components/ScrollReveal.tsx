"use client";

import { useEffect } from "react";

/**
 * Lets the elements marked with reveal() (data-reveal) rise into view the first time they are scrolled to.
 *
 * The pages are prerendered and must read the same without JavaScript, so nothing is hidden in the HTML or by CSS alone:
 * this hides only what is still below the viewport when it mounts, and shows each element once as it arrives. What is
 * already on screen (or above it, after a jump to an anchor) is left alone, so nothing visible ever blinks.
 * With reduced motion, or without IntersectionObserver, it does nothing and the page stays as rendered.
 * Renders nothing; mount it once on a page that uses reveal().
 */
export function ScrollReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          observer.unobserve(element);
          element.dataset.reveal = "shown";
          // Once it has arrived, drop the animation: its fill would otherwise keep overriding the element's own transforms.
          const done = (event: AnimationEvent) => {
            if (event.target !== element) return;
            element.removeEventListener("animationend", done);
            element.removeEventListener("animationcancel", done);
            element.dataset.reveal = "";
          };
          element.addEventListener("animationend", done);
          element.addEventListener("animationcancel", done);
        }
      },
      // Start a little after the edge enters, so the movement happens where it can be seen.
      { rootMargin: "0px 0px -8% 0px" },
    );

    const pending: HTMLElement[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("[data-reveal]")) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.dataset.reveal = "pending";
      pending.push(element);
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      for (const element of pending) {
        if (element.dataset.reveal === "pending") element.dataset.reveal = "";
      }
    };
  }, []);

  return null;
}
