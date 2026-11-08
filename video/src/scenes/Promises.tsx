import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Icon, Paper, useEnter } from "../ui";

/** The value strip: a two-part title with three promises below it. */
export function Promises({ t }: { t: VideoCopy }) {
  const lead = useEnter(0, { distance: 40 });
  const strong = useEnter(14, { distance: 40 });
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
          gap: 72,
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontFamily: font.heading,
            fontWeight: 600,
            fontSize: 104,
            lineHeight: 1.2,
            letterSpacing: "-0.025em",
          }}
        >
          <div style={{ ...lead, color: color.muted }}>{t.valueLead}</div>
          <div style={strong}>{t.valueStrong}</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {t.promises.map((promise, index) => (
            <Promise key={promise} text={promise} delay={40 + index * 12} />
          ))}
        </div>
      </div>
    </Paper>
  );
}

function Promise({ text, delay }: { text: string; delay: number }) {
  const enter = useEnter(delay, { distance: 24 });
  return (
    <div
      style={{
        ...enter,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 32px",
        border: `1px solid ${color.border}`,
        borderRadius: radius.panel,
        fontSize: 30,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: 999,
          backgroundColor: color.highlight,
          color: color.ink,
        }}
      >
        <Icon name="check" size={20} strokeWidth={2.4} />
      </span>
      {text}
    </div>
  );
}
