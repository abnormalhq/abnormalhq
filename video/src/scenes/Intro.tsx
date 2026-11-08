import { interpolate, useCurrentFrame } from "remotion";
import { BrandMark } from "../BrandMark";
import type { VideoCopy } from "../copy";
import { color, font } from "../theme";
import { Paper, useEnter, useSpringAt } from "../ui";

const WORD = "abnormal";

export function Intro({ t }: { t: VideoCopy }) {
  const frame = useCurrentFrame();
  const pop = useSpringAt(0, 34, 14);
  const tagline = useEnter(52, { distance: 14 });
  return (
    <Paper>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <div
          style={{
            transform: `scale(${0.4 + pop * 0.6}) rotate(${(1 - pop) * -14}deg)`,
            opacity: Math.min(1, pop * 2),
          }}
        >
          <BrandMark size={168} radius={24} />
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: font.heading,
            fontWeight: 600,
            fontSize: 124,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {[...WORD].map((letter, index) => {
            const start = 14 + index * 3;
            const opacity = interpolate(frame, [start, start + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const y = interpolate(frame, [start, start + 14], [18, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span key={index} style={{ opacity, transform: `translateY(${y}px)`, display: "inline-block" }}>
                {letter}
              </span>
            );
          })}
          <span
            style={{
              display: "inline-block",
              opacity: interpolate(frame, [40, 46], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${interpolate(frame, [40, 52], [1.8, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`,
              transformOrigin: "50% 80%",
            }}
          >
            .
          </span>
        </div>
        <div
          style={{
            ...tagline,
            fontFamily: font.mono,
            fontSize: 26,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: color.muted,
          }}
        >
          {t.tagline}
        </div>
      </div>
    </Paper>
  );
}
