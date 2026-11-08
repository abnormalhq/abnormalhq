// The theme script is inlined into the head and runs synchronously, setting data-theme before first paint; a separate file so tests/theme.test.ts can load it directly.
import themeInitializer from "@/scripts/theme-init.js";

/** theme-color must come before the script: the script rewrites it to match the actual theme when it runs. */
export function ThemeHead() {
  return (
    <>
      <meta name="theme-color" content="#f7f7f4" />
      <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
    </>
  );
}
