import { interpolate, useCurrentFrame } from "remotion";
import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Eyebrow, Icon, Paper, useEnter } from "../ui";

const icons = ["user", "cart", "mail", "book"] as const;

/** The activation process: four steps side by side, numbers highlighted as if by a yellow marker, and a thin line connecting them. */
export function Steps({ t }: { t: VideoCopy }) {
  const frame = useCurrentFrame();
  const eyebrow = useEnter(0);
  const title = useEnter(10, { distance: 36 });
  const line = interpolate(frame, [30, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Paper>
      <div style={{ position: "absolute", left: 140, top: 180 }}>
        <Eyebrow style={eyebrow}>A simple way to get started</Eyebrow>
        <h2
          style={{
            ...title,
            margin: "34px 0 0",
            fontFamily: font.heading,
            fontWeight: 600,
            fontSize: 84,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {t.stepsTitle}
          {t.dot}
        </h2>
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 450, height: 1, backgroundColor: color.border }}>
        <div style={{ height: 1, width: `${line * 100}%`, backgroundColor: color.ink }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 140,
          right: 140,
          top: 520,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 56,
        }}
      >
        {t.steps.map((step, index) => (
          <Step
            key={step.title}
            index={index}
            title={step.title}
            description={step.description}
            delay={36 + index * 22}
          />
        ))}
      </div>
    </Paper>
  );
}

function Step({
  index,
  title,
  description,
  delay,
}: {
  index: number;
  title: string;
  description: string;
  delay: number;
}) {
  const enter = useEnter(delay, { distance: 40 });
  const icon = icons[index] ?? "mail";
  return (
    <div style={enter}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <span
          style={{
            fontFamily: font.heading,
            fontWeight: 300,
            fontSize: 104,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            padding: "0 0.06em",
            backgroundImage: `linear-gradient(transparent 56%, ${color.highlight} 56% 90%, transparent 90%)`,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ flex: 1, height: 1, backgroundColor: color.border }} />
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 64,
            height: 64,
            borderRadius: radius.mark,
            border: `1px solid ${color.border}`,
          }}
        >
          <Icon name={icon} size={30} />
        </span>
      </div>
      <h3 style={{ margin: "40px 0 0", fontSize: 38, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      <p style={{ margin: "18px 0 0", fontSize: 24, lineHeight: 1.6, color: color.muted }}>{description}</p>
    </div>
  );
}
