import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, font, radius } from "./theme";

/** 从第 delay 帧起入场：先透明、偏下，弹簧回到原位。返回可直接铺到 style 上的值。 */
export function useEnter(delay: number, { distance = 28, durationInFrames = 26 } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, durationInFrames, config: { damping: 200 } });
  return {
    opacity: interpolate(frame - delay, [0, durationInFrames * 0.6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    transform: `translateY(${(1 - progress) * distance}px)`,
  } satisfies CSSProperties;
}

/** 弹簧式的 0→1，用于缩放、旋转等。 */
export function useSpringAt(delay: number, durationInFrames = 30, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, durationInFrames, config: { damping } });
}

/** 纸色背景与四角的「+」记号（首屏插图里的那种）。 */
export function Paper({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <AbsoluteFill style={{ backgroundColor: color.paper, color: color.ink, fontFamily: font.body, ...style }}>
      {(["top", "bottom"] as const).flatMap((v) =>
        (["left", "right"] as const).map((h) => (
          <span
            key={`${v}-${h}`}
            style={{
              position: "absolute",
              [v]: 44,
              [h]: 60,
              fontSize: 34,
              fontWeight: 300,
              lineHeight: 1,
              color: color.muted,
              fontFamily: font.heading,
            }}
          >
            +
          </span>
        )),
      )}
      {children}
    </AbsoluteFill>
  );
}

/** 小标：英文等宽小字，前面一个墨色圆点。 */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: font.mono,
        fontSize: 22,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color.muted,
        ...style,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color.ink }} />
      {children}
    </div>
  );
}

/** 装饰：两圈细线圆环，中间一个浅灰的大「@」，缓慢转动。 */
export function Rings({ size, style, spin = 0 }: { size: number; style?: CSSProperties; spin?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: 999,
        border: `1px solid ${color.border}`,
        display: "grid",
        placeItems: "center",
        ...style,
      }}
    >
      <div
        style={{ position: "absolute", inset: size * 0.11, borderRadius: 999, border: `1px solid ${color.border}` }}
      />
      <span
        style={{
          fontFamily: font.heading,
          fontWeight: 300,
          fontSize: size * 0.62,
          lineHeight: 1,
          color: color.surface,
          transform: `rotate(${-18 + spin}deg) translateY(-${size * 0.03}px)`,
        }}
      >
        @
      </span>
    </div>
  );
}

type IconName =
  "check" | "up-right" | "arrow" | "sparkle" | "chat" | "shield" | "plus" | "user" | "cart" | "mail" | "book";

const paths: Record<IconName, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  "up-right": <path d="M7 7h10v10M7 17 17 7" />,
  arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
  sparkle: <path d="M12 3c.6 4.7 4.3 8.4 9 9-4.7.6-8.4 4.3-9 9-.6-4.7-4.3-8.4-9-9 4.7-.6 8.4-4.3 9-9z" />,
  chat: (
    <>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  user: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  cart: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </>
  ),
  mail: (
    <>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </>
  ),
};

/** 与官网相同风格的线条图标（lucide 的描法，描边 1.6）。 */
export function Icon({
  name,
  size = 24,
  style,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {paths[name]}
    </svg>
  );
}

/** 细描边、不铺底色、不加阴影的面板。 */
export const panel: CSSProperties = {
  border: `1px solid ${color.border}`,
  borderRadius: radius.panel,
  backgroundColor: color.paper,
};
