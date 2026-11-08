import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * 官网自托管的三款可变字体（../public/fonts/，remotion.config.ts 把 public 目录指到那里），
 * 加上 Google Fonts 的 Noto Sans SC 补中文字形。渲染时需要联网取 Noto Sans SC，与 scripts/og-images.ts 相同。
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
