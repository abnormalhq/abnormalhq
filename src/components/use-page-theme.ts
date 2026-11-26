"use client";

import { useSyncExternalStore } from "react";

export type PageTheme = "light" | "dark";

function subscribe(onChange: () => void) {
  window.addEventListener("abnormal:themechange", onChange);
  return () => window.removeEventListener("abnormal:themechange", onChange);
}

/** The theme ThemeScript painted (<html data-theme>), which "system" has already resolved to light or dark. */
function getTheme(): PageTheme | null {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : null;
}

const getServerTheme = () => null;

/**
 * The page's theme as painted, following every change ThemeScript announces. null on the server and while hydrating, when it is not
 * known yet; the render right after hydration has it.
 */
export function usePageTheme(): PageTheme | null {
  return useSyncExternalStore(subscribe, getTheme, getServerTheme);
}
