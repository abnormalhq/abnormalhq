"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/data/site";

type Theme = "light" | "dark";

/**
 * WebMail's demo page (abnormalhq/mail, docs/webmail-demo.md): the deployed WebMail workspace on a sample mailbox. Its API is
 * answered inside the page, so nothing is signed in, stored on a server or sent. It is the only WebMail page that lets this
 * site frame it.
 */
const DEMO_URL = "https://webmail.abnormalhq.com/demo";

function subscribe(onChange: () => void) {
  window.addEventListener("abnormal:themechange", onChange);
  return () => window.removeEventListener("abnormal:themechange", onChange);
}

/** The theme ThemeScript painted (<html data-theme>), which "system" has already resolved to light or dark. */
function getTheme(): Theme | null {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : null;
}

const getServerTheme = () => null;

/**
 * "Try it yourself": the real WebMail in a frame, in the page's language and theme. The frame is added once the theme is
 * known in the browser, so it loads once in the right theme instead of loading in the server's guess and again in the
 * visitor's; choosing another theme reloads it in that one.
 */
export function WebmailDemo({ lang, label }: { lang: Lang; label: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const className = "block h-180 w-full overflow-hidden rounded-panel border border-border bg-card max-md:h-160";
  if (!theme) return <div className={className} />;
  return (
    <iframe
      className={className}
      src={`${DEMO_URL}?${new URLSearchParams({ lang, theme })}`}
      title={label}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
