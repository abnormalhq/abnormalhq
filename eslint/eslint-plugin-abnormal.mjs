/*
 * An ESLint plugin that keeps hand-picked values out of a product's UI, so a change to the theme reaches every screen.
 * Install it with `shadcn add @abnormal/eslint-plugin`, then in eslint.config.mjs:
 *
 *   import css from "@eslint/css";
 *   import abnormal from "./eslint/eslint-plugin-abnormal.mjs";
 *
 *   { files: ["**\/*.{ts,tsx}"], plugins: { abnormal }, rules: { "abnormal/no-hardcoded-classes": "error" } },
 *   { files: ["**\/*.css"], language: "css/css", languageOptions: { tolerant: true }, plugins: { css, abnormal },
 *     rules: { "abnormal/no-hardcoded-css": "error" } },
 *
 * and leave out the theme (abnormal.css), where the literal values live. `tolerant` lets the CSS parser read Tailwind's
 * at-rules (@theme, @utility) instead of stopping at them. The installed components pass both rules; the few values in them
 * that have to stay carry an eslint-disable comment, which is why the plugin has to be loaded wherever they are.
 * In a project with existing values, `eslint --suppress-rule abnormal/no-hardcoded-classes` records them in
 * eslint-suppressions.json, so only new ones fail; the file shrinks as they are fixed (`eslint --prune-suppressions`).
 *
 * no-hardcoded-classes reads every string in a TS or TSX file as a possible class list, and the style objects of JSX:
 * - Tailwind's palette (text-zinc-500, bg-sky-500/12) and arbitrary colors (bg-[#f7f7f4]): use a semantic color, or a
 *   category hue for things told apart by color.
 * - dark: with a color: the theme's colors already change with the theme.
 * - Arbitrary font sizes (text-[13px]): use the type scale, text-2xs to text-display-lg. text-[0px], which hides text
 *   while keeping it in the accessibility tree, stays allowed.
 * - Arbitrary whole-pixel spacing (mt-[18px]): use a spacing step (mt-4.5), so the density reaches it.
 * - Tailwind's own radii and shadows (rounded-md, shadow-lg) and arbitrary radii above 2px: use rounded-chip /
 *   control / mark / panel / dialog and shadow-panel / popover. rounded-xs (2px) and pill radii of 999px or more stay
 *   allowed, like rounded-full.
 * - Numeric layers (z-50, z-[60]): use z-raised, z-sticky, z-header, z-overlay, z-floating or z-skip-link. Small
 *   arbitrary layers under 10 (z-[2]) stay allowed for stacking inside one component, and so do negative ones (-z-10,
 *   behind the parent).
 * - Letter spacing that has a name (tracking-[-0.02em]): tracking-title, heading, display or caps.
 * - Hex and rgb() colors in a JSX style object.
 *
 * no-hardcoded-css checks declarations in CSS files (custom property definitions are left alone):
 * - Hex, rgb(), hsl() and oklch() colors: use var(--token).
 * - font-size in px or rem: var(--text-*).
 * - padding, margin, gap and inset in px of 3 or more: --spacing(n) or calc(var(--spacing) * n).
 * - border-radius in px above 2 and below 999 (a pill): var(--radius-*).
 * - z-index of 10 or more: var(--z-index-*).
 *
 * A value that has to stay (a QR code's white, a brand lockup's 17px, an email's inline colors) takes an
 * eslint-disable comment that says why.
 */

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_PROPS =
  "text|bg|border|border-[trblxyse]|ring|ring-offset|fill|stroke|from|via|to|outline|divide|decoration|shadow|accent|caret|placeholder|inset-shadow|inset-ring";
const SPACING_PROPS =
  "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|left|right|bottom|start|end|scroll-m|scroll-mt|scroll-mb|scroll-p|scroll-pt|scroll-pb";

const palette = new RegExp(`^-?(?:${COLOR_PROPS})-(?:${PALETTE})-\\d{2,3}(?:/\\d+)?$`);
const blackWhite = new RegExp(`^(?:${COLOR_PROPS})-(?:black|white)(?:/\\d+)?$`);
const arbitraryColor = new RegExp(`^(?:${COLOR_PROPS})-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\(|color:#)`);
const fontSize = /^text-\[(?!0(?:px|rem)?\])\d*\.?\d+(?:px|rem)\]$/;
const spacing = new RegExp(`^-?(?:${SPACING_PROPS})-\\[\\d+(?:px|rem)\\]$`);
const radius =
  /^rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?-(?:(sm|md|lg|xl|2xl|3xl|4xl)|\[(\d*\.?\d+)(px|rem)\])$/;
const shadow = /^shadow-(?:2xs|xs|sm|md|lg|xl|2xl)$/;
const zStep = /^z-(?:10|20|30|40|50)$/;
const zArbitrary = /^z-\[(\d+)\]$/;
const tracking = /^tracking-\[(-0\.01em|-0\.02em|-0\.03em|0\.06em)\]$/;
const trackingName = { "-0.01em": "title", "-0.02em": "heading", "-0.03em": "display", "0.06em": "caps" };
const literalColor = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(\s*\d/;

/** The utility a class names, without its variants (hover:, md:, dark:, group-data-[x]/name:) or the ! marker. */
function split(token) {
  let depth = 0;
  let cut = -1;
  for (let index = 0; index < token.length; index++) {
    const char = token[index];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    else if (char === ":" && depth === 0) cut = index;
  }
  const variants = cut < 0 ? [] : token.slice(0, cut).split(":");
  const utility = token.slice(cut + 1).replace(/^!|!$/g, "");
  return { variants, utility };
}

/** What is wrong with one class, or undefined. */
export function checkClass(token) {
  const { variants, utility } = split(token);
  const isColor = palette.test(utility) || blackWhite.test(utility) || arbitraryColor.test(utility);
  if (variants.includes("dark") && isColor)
    return `"${token}": the theme's colors already change with the theme; use a semantic color without dark:.`;
  if (palette.test(utility))
    return `"${token}": use a semantic color (text-muted-foreground, text-destructive, text-warning, text-success) or a category hue (text-category-blue).`;
  if (arbitraryColor.test(utility)) return `"${token}": use a theme color instead of a literal one.`;
  if (blackWhite.test(utility))
    return `"${token}": use a theme color (bg-overlay for a backdrop, bg-background, text-foreground); a value that must stay white or black says why in an eslint-disable comment.`;
  if (fontSize.test(utility)) return `"${token}": use the type scale (text-2xs, text-xs … text-display-lg).`;
  if (spacing.test(utility)) {
    const [, value, unit] = utility.match(/\[(\d+)(px|rem)\]/);
    const px = Number(value) * (unit === "rem" ? 16 : 1);
    if (px >= 3)
      return `"${token}": use a spacing step (${utility.replace(/\[.*\]/, String(px / 4))}), so the density reaches it.`;
  }
  const corner = utility.match(radius);
  const cornerPx = corner && Number(corner[2]) * (corner[3] === "rem" ? 16 : 1);
  if (corner && (corner[1] || (cornerPx > 2 && cornerPx < 999)))
    return `"${token}": use rounded-chip, rounded-control, rounded-mark, rounded-panel or rounded-dialog.`;
  if (shadow.test(utility)) return `"${token}": use shadow-panel or shadow-popover.`;
  if (zStep.test(utility) || (zArbitrary.test(utility) && Number(utility.match(zArbitrary)[1]) >= 10))
    return `"${token}": use the stacking scale (z-raised, z-sticky, z-header, z-overlay, z-floating, z-skip-link).`;
  const named = utility.match(tracking);
  if (named) return `"${token}": use tracking-${trackingName[named[1]]}.`;
  return undefined;
}

/** @type {import("eslint").Rule.RuleModule} */
const noHardcodedClasses = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the theme's semantic colors, type scale, spacing steps, radii, shadows and layers in classes.",
    },
    schema: [],
  },
  create(context) {
    function checkString(node, value) {
      if (value.length > 4000 || !value.includes("-")) return;
      for (const token of value.split(/\s+/)) {
        if (!token) continue;
        const problem = checkClass(token);
        if (problem) context.report({ node, message: problem });
      }
    }
    function inStyleAttribute(node) {
      for (const ancestor of context.sourceCode.getAncestors(node).reverse()) {
        if (ancestor.type === "JSXAttribute") return ancestor.name?.name === "style";
        if (ancestor.type === "CallExpression" || ancestor.type.startsWith("Function")) return false;
      }
      return false;
    }
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (node.parent?.type === "Property" && node.parent.value === node && inStyleAttribute(node)) {
          if (literalColor.test(node.value))
            context.report({ node, message: `"${node.value}": use var(--token) for a color in a style object.` });
          return;
        }
        if (node.parent?.type === "ImportDeclaration" || node.parent?.type === "ExportNamedDeclaration") return;
        checkString(node, node.value);
      },
      TemplateElement(node) {
        checkString(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

const SPACING_CSS =
  /^(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$|^(?:row-|column-)?gap$|^inset(?:-inline|-block)?(?:-start|-end)?$/;

/** @type {import("eslint").Rule.RuleModule} */
const noHardcodedCss = {
  meta: {
    type: "suggestion",
    docs: { description: "Use the theme's colors, type scale, spacing steps, radii and layers in handwritten CSS." },
    schema: [],
  },
  create(context) {
    return {
      Declaration(node) {
        const property = node.property.toLowerCase();
        if (property.startsWith("--")) return;
        const value = context.sourceCode.getText(node.value);
        const report = (message) => context.report({ node, message: `${property}: ${value.trim()}: ${message}` });
        if (literalColor.test(value)) return report("use var(--token) instead of a literal color.");
        if (property === "font-size" && /(?:^|[\s(,])\d*\.?\d+(?:px|rem)\b/.test(value) && !/var\(|clamp\(/.test(value))
          return report("use var(--text-*) from the type scale.");
        if (SPACING_CSS.test(property)) {
          const large = [...value.matchAll(/(?<![\w.(-])-?(\d*\.?\d+)px\b/g)].some(([, n]) => Number(n) >= 3);
          if (large)
            return report("use spacing steps (--spacing(n), or calc(var(--spacing) * n) where Tailwind does not run).");
        }
        if (
          property.endsWith("radius") &&
          [...value.matchAll(/(\d*\.?\d+)px\b/g)].some(([, n]) => Number(n) > 2 && Number(n) < 999)
        )
          return report("use var(--radius-chip), var(--radius-control), var(--radius-mark) or var(--radius-panel).");
        if (property === "z-index" && /^\s*\d+\s*$/.test(value) && Number(value) >= 10)
          return report("use var(--z-index-*) from the stacking scale.");
      },
    };
  },
};

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: "eslint-plugin-abnormal" },
  rules: { "no-hardcoded-classes": noHardcodedClasses, "no-hardcoded-css": noHardcodedCss },
};

export default plugin;
