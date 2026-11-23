import * as React from "react";

/*
 * The theme of a page that keeps the visitor's choice in the browser, without a provider: a script inlined in <head>
 * writes <html data-theme> and color-scheme before the first paint, from the saved choice or the system's, follows the
 * system while the choice is "system", and follows other tabs through the storage event. It hangs the preference on
 * window.abnormalTheme and announces each change with an "abnormal:themechange" event, which useThemePreference
 * (use-theme-preference.ts) reads for a ThemePicker. Storage that throws (a private window, a blocked origin) leaves
 * the theme working for the visit.
 */

const STORAGE_KEY = "abnormal-theme";
/** The page's background (--bg) in each theme, for the browser's own chrome through <meta name="theme-color">. */
const LIGHT = "#f7f7f4";
const DARK = "#141412";

type DefaultTheme = "system" | "light" | "dark";

/**
 * The script for a page whose visitors start on `defaultTheme`: "system" follows the system's appearance until a
 * choice is made, "light" or "dark" paints that theme until a choice is made. A choice equal to the default is not
 * stored, so changing the default later reaches everyone who never chose otherwise.
 */
function createThemeScript(defaultTheme: DefaultTheme = "system") {
  return `(() => {
  const storageKey = "${STORAGE_KEY}";
  const defaultPreference = "${defaultTheme}";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;

  const readPreference = () => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" || saved === "system" ? saved : defaultPreference;
    } catch {
      return defaultPreference;
    }
  };

  let preference = readPreference();

  const applyTheme = () => {
    const theme = preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "${DARK}" : "${LIGHT}");
    window.dispatchEvent(new CustomEvent("abnormal:themechange"));
  };

  window.abnormalTheme = {
    getPreference: () => preference,
    setPreference(nextPreference) {
      preference = nextPreference;
      try {
        if (preference === defaultPreference) {
          window.localStorage.removeItem(storageKey);
        } else {
          window.localStorage.setItem(storageKey, preference);
        }
      } catch {
        // The theme still works when browser storage is unavailable.
      }
      applyTheme();
    },
  };

  systemTheme.addEventListener("change", () => {
    if (preference === "system") applyTheme();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = readPreference();
    applyTheme();
  });
  applyTheme();
})();`;
}

/** The script itself, following the system by default, for a project that inlines it some other way, or runs it in a test. */
const themeScript = createThemeScript();

/**
 * Render once in <head>, before anything that paints. The meta tag comes first: the script rewrites its color to
 * match the theme it applies. Give <html> suppressHydrationWarning, since the script sets attributes React did not
 * render. `nonce` is for a Content Security Policy that allows inline scripts by nonce. `defaultTheme` is where a
 * visitor who has not chosen starts: the system's appearance (the default), or "dark" or "light" for a site whose
 * look is one of them. Choosing "system" in the picker is then stored, since it is no longer the default.
 */
function ThemeScript({ nonce, defaultTheme = "system" }: { nonce?: string; defaultTheme?: DefaultTheme }) {
  return (
    <>
      <meta name="theme-color" content={defaultTheme === "dark" ? DARK : LIGHT} />
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: createThemeScript(defaultTheme) }} />
    </>
  );
}

export { ThemeScript, createThemeScript, themeScript, type DefaultTheme };
