import { Composition } from "remotion";
import { loadFonts } from "./fonts";
import { durationInFrames, Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";

void loadFonts();

/**
 * One composition per language and theme: promo-en and promo-zh in the site's light theme, promo-en-dark and promo-zh-dark in its dark
 * one. The poster is a frame taken from the same composition with remotion still (see package.json).
 */
export function Root() {
  return (
    <>
      {(["en", "zh"] as const).flatMap((lang) =>
        (["light", "dark"] as const).map((theme) => (
          <Composition
            key={`${lang}-${theme}`}
            id={theme === "light" ? `promo-${lang}` : `promo-${lang}-${theme}`}
            component={Promo}
            durationInFrames={durationInFrames()}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
            defaultProps={{ lang, theme }}
          />
        )),
      )}
    </>
  );
}
