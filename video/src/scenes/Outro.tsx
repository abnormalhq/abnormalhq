import { useCurrentFrame } from "remotion";
import { BrandMark } from "../BrandMark";
import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Icon, Paper, Rings, useEnter, useSpringAt } from "../ui";

/** Closing: the brand mark, the "Your next email starts here." line, the buy button and the site address. */
export function Outro({ t }: { t: VideoCopy }) {
  const frame = useCurrentFrame();
  const mark = useSpringAt(0, 30, 14);
  const title = useEnter(10, { distance: 40 });
  const button = useEnter(32, { distance: 24 });
  const url = useEnter(48, { distance: 16 });
  return (
    <Paper>
      <Rings size={1000} spin={frame * 0.04} style={{ left: 460, top: 40, opacity: 0.9 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
        }}
      >
        <div style={{ transform: `scale(${0.5 + mark * 0.5})`, opacity: Math.min(1, mark * 2) }}>
          <BrandMark size={120} radius={18} />
        </div>
        <h2
          style={{
            ...title,
            margin: 0,
            textAlign: "center",
            fontFamily: font.serif,
            fontWeight: t.htmlLang === "en" ? 400 : 500,
            fontSize: 112,
            lineHeight: 1.16,
            letterSpacing: t.htmlLang === "en" ? "-0.025em" : "0em",
          }}
        >
          {t.closingLines[0]}
          {t.htmlLang === "en" ? " " : ""}
          <span style={{ color: color.muted }}>{t.closingLines[1]}</span>
        </h2>
        <div
          style={{
            ...button,
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 8,
            padding: "22px 40px",
            borderRadius: radius.control,
            backgroundColor: color.ink,
            color: color.onInk,
            fontSize: 32,
            fontWeight: 500,
          }}
        >
          {t.buy} <Icon name="arrow" size={28} strokeWidth={2} />
        </div>
        <div style={{ ...url, fontFamily: font.mono, fontSize: 28, letterSpacing: "0.04em", color: color.muted }}>
          abnormalhq.com
        </div>
      </div>
    </Paper>
  );
}
