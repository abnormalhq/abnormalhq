import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * The site's three self-hosted variable fonts (../public/fonts/, where remotion.config.ts points the public directory),
 * plus Noto Sans SC from Google Fonts for Chinese glyphs. Rendering needs network access for Noto Sans SC, the same as scripts/og-images.ts.
 */
export function loadFonts() {
  return Promise.all([
    loadFont({ family: "Inter", url: staticFile("fonts/Inter-Variable.woff2"), weight: "100 900" }),
    loadFont({
      family: "Bricolage Grotesque",
      url: staticFile("fonts/BricolageGrotesque-Variable.woff2"),
      weight: "200 800",
    }),
    loadFont({ family: "JetBrains Mono", url: staticFile("fonts/JetBrainsMono-Variable.woff2"), weight: "100 800" }),
    loadNotoSansSC("normal", {
      weights: ["400", "500", "600"],
      subsets: ["chinese-simplified", "latin"],
    }).waitUntilDone(),
  ]);
}
