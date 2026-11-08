import { Composition } from "remotion";
import { loadFonts } from "./fonts";
import { durationInFrames, Promo } from "./Promo";
import { FPS, HEIGHT, WIDTH } from "./theme";

void loadFonts();

/** 两种语言各一个合成：promo-en 与 promo-zh。封面图用 remotion still 从同一个合成里取一帧（见 package.json）。 */
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
