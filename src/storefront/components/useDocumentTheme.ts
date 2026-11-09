"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme in effect, read from <html data-theme>, which the site's theme-init.js sets before first paint and updates when the
 * header's theme picker or the system appearance changes. "light" during prerendering, where there is no document.
 */
export function useDocumentTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, read, () => "light");
}

function read(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
