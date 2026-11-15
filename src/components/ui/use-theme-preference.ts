import { useSyncExternalStore } from "react";

type ThemePreference = "system" | "light" | "dark";

declare global {
  interface Window {
    /** Set by ThemeScript in <head>, before hydration. */
    abnormalTheme?: {
      getPreference(): ThemePreference;
      setPreference(preference: ThemePreference): void;
    };
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("abnormal:themechange", onChange);
  return () => window.removeEventListener("abnormal:themechange", onChange);
}
const getPreference = () => window.abnormalTheme?.getPreference();
const getServerPreference = () => undefined;

/**
 * The preference ThemeScript keeps, and the function that changes it: `[preference, setPreference]`, for
 * `<ThemePicker value={preference} onValueChange={setPreference} />`. The preference is undefined in the server's
 * HTML and during hydration, as ThemePicker expects before it is known, and also on a page without ThemeScript.
 */
function useThemePreference() {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  return [preference, setThemePreference] as const;
}

function setThemePreference(preference: ThemePreference) {
  window.abnormalTheme?.setPreference(preference);
}

export { useThemePreference, setThemePreference, type ThemePreference };
