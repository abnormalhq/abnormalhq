import { Composition } from "remotion";
import { loadFonts } from "./fonts";
import { durationInFrames, Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";

void loadFonts();

/** One composition per language: promo-en and promo-zh. The poster is a frame taken from the same composition with remotion still (see package.json). */
export function Root() {
  return (
    <>
      {(["en", "zh"] as const).map((lang) => (
        <Composition
          key={lang}
          id={`promo-${lang}`}
          component={Promo}
          durationInFrames={durationInFrames()}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ lang }}
        />
      ))}
    </>
  );
}
