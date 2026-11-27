import { BrandMark } from "../BrandMark";
import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Eyebrow, Paper, useEnter } from "../ui";

/** Editorial serif cover matching the website's hero: brand bar above, serif headline with one highlighter stroke, and crisp @abnormalhq.com address pill. */
export function Headline({ t }: { t: VideoCopy }) {
  const eyebrow = useEnter(0);
  const line1 = useEnter(10, { distance: 36 });
  const line2 = useEnter(20, { distance: 36 });
  const desc = useEnter(38);
  const at = t.titleLines[1].indexOf(t.marked);
  const before = at >= 0 ? t.titleLines[1].slice(0, at) : t.titleLines[1];
  const after = at >= 0 ? t.titleLines[1].slice(at + t.marked.length) : "";

  return (
    <Paper>
      <div
        style={{
          position: "absolute",
          inset: "110px 140px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 42,
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <BrandMark size={64} radius={8} />
            <span
              style={{
                fontFamily: font.heading,
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: color.ink,
              }}
            >
              abnormal.
            </span>
          </div>
          <span
            style={{
              backgroundColor: color.sageSoft,
              color: color.sageInk,
              fontFamily: font.mono,
              fontSize: 28,
              fontWeight: 500,
              padding: "12px 24px",
              borderRadius: radius.control,
            }}
          >
            @abnormalhq.com
          </span>
        </div>

        <div style={{ marginTop: 84 }}>
          <Eyebrow style={eyebrow}>{t.eyebrow}</Eyebrow>
          <h1
            style={{
              margin: "34px 0 0",
              fontFamily: font.serif,
              fontWeight: t.htmlLang === "en" ? 400 : 500,
              fontSize: t.htmlLang === "en" ? 132 : 124,
              lineHeight: t.htmlLang === "en" ? 1.08 : 1.16,
              letterSpacing: t.htmlLang === "en" ? "-0.03em" : "0em",
            }}
          >
            <span style={{ display: "block", ...line1 }}>{t.titleLines[0]}</span>
            <span style={{ display: "block", ...line2 }}>
              {before}
              {at >= 0 && (
                <span
                  style={{
                    backgroundImage: `linear-gradient(transparent ${color.markerFrom}, ${color.highlight} ${color.markerFrom} ${color.markerTo}, transparent ${color.markerTo})`,
                    padding: "0 0.06em",
                  }}
                >
                  {t.marked}
                </span>
              )}
              {after}
            </span>
          </h1>
        </div>

        <div
          style={{
            ...desc,
            marginTop: "auto",
            paddingTop: 38,
            borderTop: `1px solid ${color.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 48,
          }}
        >
          <p style={{ margin: 0, maxWidth: 1260, fontSize: 34, lineHeight: 1.55, color: color.muted }}>
            {t.description}
          </p>
          <span style={{ fontFamily: font.mono, fontSize: 28, color: color.ink, whiteSpace: "nowrap" }}>
            abnormalhq.com
          </span>
        </div>
      </div>
    </Paper>
  );
}
