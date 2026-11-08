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

/** 每个场景的时长（帧，30fps）；相邻场景之间淡入淡出 FADE 帧，总长见 durationInFrames()。 */
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
      {/* 背景音乐由 scripts/music.ts 合成（pnpm music），自带淡入淡出，长度与画面一致。 */}
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
