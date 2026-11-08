import { interpolate, useCurrentFrame } from "remotion";
import type { VideoCopy } from "../copy";
import { color, font, radius } from "../theme";
import { Icon, Paper, panel, useEnter, useSpringAt } from "../ui";

const avatars = [
  { icon: "sparkle", color: color.ink },
  { icon: "chat", color: color.muted },
  { icon: "check", color: color.muted },
] as const;

/** The hero illustration enlarged: the inbox card, the yellow "GOOD MAIL. GOOD DAYS." block and the personal address card. */
export function Inbox({ t }: { t: VideoCopy }) {
  const frame = useCurrentFrame();
  const m = t.mock;
  const card = useSpringAt(0, 34, 18);
  const tile = useSpringAt(26, 30, 12);
  const address = useSpringAt(120, 30, 14);
  const note = useEnter(0);
  const heading = useEnter(10, { distance: 36 });
  const badge = Math.round(
    interpolate(frame, [46, 100], [0, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  return (
    <Paper>
      <div style={{ position: "absolute", left: 140, top: 250, width: 740 }}>
        <div
          style={{
            ...note,
            fontFamily: font.mono,
            fontSize: 22,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: color.muted,
          }}
        >
          {m.overline}
        </div>
        <h2
          style={{
            ...heading,
            margin: "36px 0 0",
            fontFamily: font.heading,
            fontWeight: 600,
            fontSize: 76,
            lineHeight: 1.2,
            textWrap: "balance",
            letterSpacing: "-0.02em",
          }}
        >
          {m.heading}
          {t.dot}
        </h2>
        <div
          style={{
            ...panel,
            marginTop: 64,
            display: "inline-flex",
            alignItems: "center",
            gap: 22,
            padding: "22px 30px",
            transform: `translateY(${(1 - address) * 40}px) rotate(${(1 - address) * 4}deg)`,
            opacity: Math.min(1, address * 2),
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 64,
              height: 64,
              borderRadius: 999,
              backgroundColor: color.surface,
              fontSize: 36,
              lineHeight: 1,
            }}
          >
            @
          </span>
          <div>
            <div style={{ fontSize: 18, color: color.muted }}>{m.domainNote}</div>
            <div style={{ marginTop: 4, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>
              hello@<span style={{ color: color.muted }}>yourname</span>.com
            </div>
          </div>
          <span
            style={{
              marginLeft: 8,
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: color.ink,
              color: color.paper,
            }}
          >
            <Icon name="check" size={20} strokeWidth={2.2} />
          </span>
        </div>
      </div>

      {/* The yellow block: always ink on yellow. */}
      <div
        style={{
          position: "absolute",
          right: 170,
          top: 110,
          width: 220,
          height: 252,
          padding: 26,
          borderRadius: radius.mark,
          backgroundColor: color.highlight,
          color: color.ink,
          transform: `rotate(${10 + (1 - tile) * 20}deg) scale(${0.5 + tile * 0.5})`,
          opacity: Math.min(1, tile * 2),
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            fontFamily: font.heading,
            fontSize: 60,
            fontWeight: 600,
            lineHeight: 0.9,
          }}
        >
          a<Icon name="up-right" size={26} strokeWidth={2} />
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 19,
            lineHeight: 1.55,
            fontWeight: 500,
            letterSpacing: "0.08em",
            fontFamily: font.body,
          }}
        >
          GOOD MAIL.
          <br />
          GOOD DAYS.
        </div>
        <span style={{ position: "absolute", right: 20, bottom: 14, fontSize: 36 }}>✳</span>
      </div>

      {/* The inbox card */}
      <div
        style={{
          ...panel,
          position: "absolute",
          left: 920,
          top: 190,
          width: 860,
          overflow: "hidden",
          transform: `translateY(${(1 - card) * 120}px) rotate(${-3 + card}deg)`,
          opacity: Math.min(1, card * 2),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 30px",
            borderBottom: `1px solid ${color.border}`,
            fontFamily: font.mono,
            fontSize: 15,
            letterSpacing: "0.13em",
            color: color.muted,
          }}
        >
          <span style={{ display: "flex", gap: 7 }}>
            <i style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: color.ink }} />
            <i style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: color.border }} />
            <i style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: color.border }} />
          </span>
          <span>YOUR EVERYDAY INBOX</span>
          <Icon name="shield" size={22} />
        </div>
        <div style={{ padding: "36px 40px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: font.heading, fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {m.heading}
              {t.dot}
            </div>
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 68,
                height: 68,
                borderRadius: 999,
                backgroundColor: color.ink,
                color: color.paper,
                fontFamily: font.heading,
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-0.06em",
              }}
            >
              a.
            </span>
          </div>
          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "flex-end",
              gap: 40,
              borderBottom: `1px solid ${color.border}`,
              fontSize: 22,
              color: color.muted,
            }}
          >
            <span
              style={{
                paddingBottom: 18,
                borderBottom: `3px solid ${color.ink}`,
                color: color.ink,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {m.inbox}
              <b
                style={{
                  padding: "3px 8px",
                  borderRadius: radius.chip,
                  backgroundColor: color.highlight,
                  color: color.ink,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: font.mono,
                }}
              >
                {String(badge).padStart(2, "0")}
              </b>
            </span>
            <span style={{ paddingBottom: 21 }}>{m.starred}</span>
            <Icon name="plus" size={26} style={{ marginLeft: "auto", marginBottom: 18 }} />
          </div>
          {m.mails.map((mail, index) => {
            const start = 46 + index * 18;
            const opacity = interpolate(frame, [start, start + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const x = interpolate(frame, [start, start + 18], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const avatar = avatars[index] ?? avatars[0];
            return (
              <div
                key={mail.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: "26px 0",
                  borderBottom: index === m.mails.length - 1 ? "none" : `1px solid ${color.border}`,
                  opacity,
                  transform: `translateX(${x}px)`,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 64,
                    height: 64,
                    borderRadius: radius.control,
                    backgroundColor: color.surface,
                    color: avatar.color,
                  }}
                >
                  <Icon name={avatar.icon} size={30} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 500 }}>{mail.title}</div>
                  <div style={{ marginTop: 6, fontSize: 19, color: color.muted }}>{mail.body}</div>
                </div>
                <div
                  style={{
                    alignSelf: "flex-start",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 10,
                    fontSize: 16,
                    color: color.muted,
                    fontFamily: font.mono,
                  }}
                >
                  {mail.time}
                  {index === 0 && (
                    <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color.ink }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Paper>
  );
}
