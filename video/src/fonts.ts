import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadNotoSerifSC } from "@remotion/google-fonts/NotoSerifSC";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * The site's self-hosted variable fonts plus the editorial serifs (Newsreader and Noto Serif SC) and Noto Sans SC for
 * Chinese body copy, matching the website's typography.
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
    loadNewsreader("normal", {
      weights: ["400", "500"],
      subsets: ["latin"],
    }).waitUntilDone(),
    loadNotoSerifSC("normal", {
      weights: ["400", "500", "600"],
      subsets: ["chinese-simplified", "latin"],
    }).waitUntilDone(),
    loadNotoSansSC("normal", {
      weights: ["400", "500", "600"],
      subsets: ["chinese-simplified", "latin"],
    }).waitUntilDone(),
  ]);
}
