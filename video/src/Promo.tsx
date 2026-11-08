import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Audio } from "remotion";
import music from "../assets/music.wav";
import { copies, type Lang } from "./copy";
import { Headline } from "./scenes/Headline";
import { Inbox } from "./scenes/Inbox";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { Promises } from "./scenes/Promises";
import { Steps } from "./scenes/Steps";

/** Duration of each scene (frames at 30fps); neighbouring scenes cross-fade over FADE frames, and durationInFrames() gives the total. */
export const SCENES = [
  { Scene: Intro, frames: 105 },
  { Scene: Headline, frames: 195 },
  { Scene: Inbox, frames: 255 },
  { Scene: Steps, frames: 285 },
  { Scene: Promises, frames: 135 },
  { Scene: Outro, frames: 150 },
] as const;
const FADE = 15;

export const durationInFrames = () =>
  SCENES.reduce((total, { frames }) => total + frames, 0) - FADE * (SCENES.length - 1);

export function Promo({ lang }: { lang: Lang }) {
  const t = copies[lang];
  return (
    <div lang={t.htmlLang} style={{ width: "100%", height: "100%" }}>
      {/* The background music is synthesized by scripts/music.ts (pnpm music), has its own fade-in and fade-out, and matches the picture's length. */}
      <Audio src={music} volume={0.9} />
      <TransitionSeries>
        {SCENES.flatMap(({ Scene, frames }, index) => [
          ...(index === 0
            ? []
            : [
                <TransitionSeries.Transition
                  key={`fade-${index}`}
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: FADE })}
                />,
              ]),
          <TransitionSeries.Sequence key={Scene.name} durationInFrames={frames}>
            <Scene t={t} />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
    </div>
  );
}
