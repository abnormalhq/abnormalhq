import { useCurrentFrame } from "remotion";
import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Eyebrow, Paper, Rings, useEnter, useSpringAt } from "../ui";

/** 首屏标题：左边两行大标题，右边是分享图里的圆环与 @abnormal.bid 标签。 */
export function Headline({ t }: { t: VideoCopy }) {
  const frame = useCurrentFrame();
  const eyebrow = useEnter(0);
  const line1 = useEnter(10, { distance: 40 });
  const line2 = useEnter(20, { distance: 40 });
  const desc = useEnter(40);
  const tag = useSpringAt(30, 30, 12);
  return (
    <Paper>
      <Rings size={760} spin={frame * 0.05} style={{ right: -120, top: 120 }} />
      <div
        style={{
          position: "absolute",
          right: 250,
          top: 300,
          transform: `rotate(${-4 - (1 - tag) * 10}deg) scale(${0.6 + tag * 0.4})`,
          opacity: Math.min(1, tag * 2),
          backgroundColor: color.highlight,
          color: color.ink,
          fontFamily: font.mono,
          fontSize: 36,
          fontWeight: 500,
          padding: "16px 28px",
          borderRadius: radius.control,
        }}
      >
        @abnormal.bid
      </div>
      <div style={{ position: "absolute", left: 140, top: 300, width: 1180 }}>
        <Eyebrow style={eyebrow}>{t.eyebrow}</Eyebrow>
        <h1
          style={{
            margin: "40px 0 0",
            fontFamily: font.heading,
            fontWeight: 600,
            fontSize: t.htmlLang === "en" ? 104 : 128,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
          }}
        >
          <span style={{ display: "block", ...line1 }}>{t.titleLines[0]}</span>
          <span style={{ display: "block", color: color.muted, ...line2 }}>
            {t.titleLines[1]}
            <span style={{ color: color.ink }}>{t.dot}</span>
          </span>
        </h1>
        <p style={{ ...desc, margin: "44px 0 0", maxWidth: 900, fontSize: 36, lineHeight: 1.6, color: color.muted }}>
          {t.description}
        </p>
      </div>
    </Paper>
  );
}
