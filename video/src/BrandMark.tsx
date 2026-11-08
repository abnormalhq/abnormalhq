import { color } from "./theme";

/** 与官网 src/components/ui/brand-mark.tsx 同一幅图：荧光黄方块上一个墨色小写 a，带纸白色错位影子和右上箭头。 */
const GLYPH_A =
  "M21.4 36 21.09 33.92Q20.26 35.01 19.14 35.59Q18.01 36.18 16.16 36.18Q14.38 36.18 13.09 35.58Q11.8 34.99 11.1 33.92Q10.4 32.85 10.4 31.41Q10.4 29.27 11.97 27.83Q13.55 26.39 16.62 26.05L21.09 25.55V24.25Q21.09 23.42 20.36 22.76Q19.63 22.09 18.08 22.09Q16.72 22.09 15.71 22.76Q14.71 23.42 14.37 24.74L11.03 23.51Q11.69 21.27 13.61 20.01Q15.52 18.76 18.28 18.76Q21.6 18.76 23.27 20.42Q24.93 22.08 24.93 24.67V36ZM21.09 28.52 16.99 29.04Q15.7 29.21 15.06 29.77Q14.41 30.34 14.41 31.17Q14.41 31.97 15.03 32.51Q15.65 33.06 16.76 33.06Q18.16 33.06 19.13 32.56Q20.1 32.07 20.59 31.11Q21.09 30.15 21.09 28.76Z";

export function BrandMark({ size, radius = size / 6 }: { size: number; radius?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", borderRadius: radius }}>
      <rect width="48" height="48" fill={color.highlight} />
      <path d={GLYPH_A} fill={color.paper} transform="translate(2.2 0)" />
      <path d={GLYPH_A} fill={color.ink} />
      <path
        d="M28 21 37.8 11.2M30.5 10H39v8.5"
        fill="none"
        stroke={color.ink}
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
