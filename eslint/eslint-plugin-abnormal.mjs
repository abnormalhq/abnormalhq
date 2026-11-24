/*
 * An ESLint plugin that keeps hand-picked values out of a product's UI, so a change to the theme reaches every screen.
 * Install it with `shadcn add @abnormal/eslint-plugin`, then in eslint.config.mjs:
 *
 *   import css from "@eslint/css";
 *   import { tailwind4 } from "tailwind-csstree";
 *   import abnormal from "./eslint/eslint-plugin-abnormal.mjs";
 *
 *   { files: ["**\/*.{ts,tsx}"], plugins: { abnormal }, rules: { "abnormal/no-hardcoded-classes": "error" } },
 *   { files: ["**\/*.css"], language: "css/css", languageOptions: { customSyntax: tailwind4 },
 *     plugins: { css, abnormal }, rules: { "abnormal/no-hardcoded-css": "error" } },
 *
 * and leave out the theme (abnormal.css), where the literal values live. The Tailwind syntax lets the CSS parser read
 * @theme, @utility, @apply with variants and nested rules, so every declaration in them is checked. A @keyframes inside
 * @theme and an @apply of an arbitrary variant (data-[state=open]:underline) are beyond that syntax for now and fail as
 * a parse error, so nothing passes unchecked; add `tolerant: true` only if your CSS holds one, knowing it also lets
 * other syntax errors (a missing brace) through. Blocks of your config
 * that set rules without `files` (eslint-config-next's, for one) also run on CSS, whose syntax their rules cannot read:
 * give them `files: ["**\/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]`.
 *
 * A value that has to stay takes a comment on its line or the line above that contains `abnormal-allow` and says why
 * (`// abnormal-allow: a QR code is black on white in every theme`). It is a plain comment, so code that carries one
 * lints the same where the plugin is not installed; the registry's components use it for that reason. An
 * `eslint-disable-next-line abnormal/no-hardcoded-classes -- reason` comment works too, where the plugin is loaded.
 * In a project with existing values, `eslint --suppress-rule abnormal/no-hardcoded-classes` records them in
 * eslint-suppressions.json, so only new ones fail; the file shrinks as they are fixed (`eslint --prune-suppressions`).
 *
 * no-hardcoded-classes reads every string in a TS or TSX file as a possible class list, and the style objects of JSX:
 * - Tailwind's palette (text-zinc-500, bg-sky-500/12) and arbitrary colors (bg-[#f7f7f4]): use a semantic color, or a
 *   category hue for things told apart by color.
 * - dark: with a color: the theme's colors already change with the theme.
 * - Arbitrary font sizes (text-[13px]): use the type scale, text-2xs to text-display-lg. text-[0px], which hides text
 *   while keeping it in the accessibility tree, stays allowed.
 * - Arbitrary whole-pixel spacing, in px or rem (mt-[18px], mt-[3.25rem]): use a spacing step (mt-4.5, mt-13), so the
 *   density reaches it. Values that fall between pixels (mt-[0.2rem]) are left alone.
 * - Tailwind's own radii and shadows (rounded-md, shadow-lg) and arbitrary radii above 2px: use rounded-chip /
 *   control / mark / panel / dialog and shadow-panel / popover. rounded-xs (2px) and pill radii of 999px or more stay
 *   allowed, like rounded-full.
 * - Numeric layers of 10 or more (z-50, z-60, z-[60]): use z-raised, z-sticky, z-header, z-chrome, z-overlay,
 *   z-floating or z-skip-link. Small arbitrary layers under 10 (z-[2]) stay allowed for stacking inside one component,
 *   and so do negative ones (-z-10, behind the parent).
 * - Letter spacing that has a name (tracking-[-0.02em]): tracking-title, heading, display or caps.
 * - Hex and rgb() colors in a JSX style object.
 *
 * no-hardcoded-css checks declarations in CSS files (custom property definitions are left alone):
 * - Hex, rgb(), hsl() and oklch() colors: use var(--token). url() references (url(#mask)) and strings are not colors.
 * - font-size, or the size in the font shorthand, in px or rem: var(--text-*).
 * - padding, margin, gap and inset in px of 3 or more: --spacing(n) or calc(var(--spacing) * n).
 * - border-radius in px above 2 and below 999 (a pill): var(--radius-*).
 * - z-index of 10 or more: var(--z-index-*).
 *
 */

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_PROPS =
  "text|bg|border|border-[trblxyse]|ring|ring-offset|fill|stroke|from|via|to|outline|divide|decoration|shadow|accent|caret|placeholder|inset-shadow|inset-ring";
const SPACING_PROPS =
  "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|left|right|bottom|start|end|scroll-m|scroll-mt|scroll-mb|scroll-p|scroll-pt|scroll-pb";

/** An opacity modifier: /50, /[.5] or /(--alpha). */
const OPACITY = "(?:/(?:\\d+|\\[[^\\]]+\\]|\\([^)]+\\)))?";
const palette = new RegExp(`^-?(?:${COLOR_PROPS})-(?:${PALETTE})-\\d{2,3}${OPACITY}$`);
const blackWhite = new RegExp(`^(?:${COLOR_PROPS})-(?:black|white)${OPACITY}$`);
const arbitraryColor = new RegExp(`^(?:${COLOR_PROPS})-\\[(?:#|rgba?\\(|hsla?\\(|oklch\\(|color:#)`);
// A line height after the size (text-[13px]/6) is part of the same class, and a length: hint names the same size.
const fontSize = /^text-\[(?:length:)?(?!0(?:px|rem)?\])\d*\.?\d+(?:px|rem)\](?:\/\S+)?$/i;
const spacing = new RegExp(`^-?(?:${SPACING_PROPS})-\\[(\\d*\\.?\\d+)(px|rem)\\]$`);
const radius =
  /^rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?-(?:(sm|md|lg|xl|2xl|3xl|4xl)|\[(\d*\.?\d+)(px|rem)\])$/;
const shadow = /^shadow-(?:2xs|xs|sm|md|lg|xl|2xl)$/;
const zNumber = /^z-(?:(\d+)|\[(\d+)\])$/;
const tracking = /^tracking-\[(-0\.01em|-0\.02em|-0\.03em|0\.06em)\]$/;
const trackingName = { "-0.01em": "title", "-0.02em": "heading", "-0.03em": "display", "0.06em": "caps" };
const literalColor = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(\s*\d/;

/**
 * A CSS value with its strings emptied and its url() references dropped: neither holds a color or a size, whatever its
 * text looks like ("#1", a family named "Mono 12px", url(#mask)). One scan reads both, so a ) inside url("a).png") or an
 * escaped quote in url(a\'b.png) cannot end either early and hide what follows.
 */
function bareValue(value) {
  let bare = "";
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    // A comment reads as a space: it holds no value, and an apostrophe in it must not open a string.
    if (value.startsWith("/*", index)) {
      const close = value.indexOf("*/", index + 2);
      index = close === -1 ? value.length : close + 1;
      bare += " ";
      continue;
    }
    const url = /^url\(/i.test(value.slice(index, index + 4)) && !/[\w-]/.test(value[index - 1] ?? "");
    if (char !== '"' && char !== "'" && !url) {
      bare += char;
      continue;
    }
    // Scan to the closing quote, or to the url's closing parenthesis outside its own quotes; a backslash escapes the
    // next character, a line break included.
    let quote = url ? null : char;
    let end = url ? index + 4 : index + 1;
    for (; end < value.length; end++) {
      const next = value[end];
      if (next === "\\") end++;
      else if (quote && next === quote) {
        if (!url) break;
        quote = null;
      } else if (!quote && (next === '"' || next === "'")) quote = next;
      else if (!quote && next === ")") break;
    }
    bare += url ? "" : '""';
    index = end;
  }
  return bare;
}

/** The value without each call of the named functions (var|clamp), however deeply their arguments nest. */
function withoutCalls(value, names) {
  const start = new RegExp(`\\b(?:${names})\\(`, "gi");
  let rest = "";
  let index = 0;
  for (let match = start.exec(value); match; match = start.exec(value)) {
    rest += value.slice(index, match.index);
    let end = match.index + match[0].length;
    for (let depth = 1; end < value.length && depth > 0; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")") depth--;
    }
    index = end;
    start.lastIndex = end;
  }
  return rest + value.slice(index);
}

/** The font shorthand without its line height: the term after the top-level slash, a calc() in it whole. */
function withoutLineHeight(value) {
  let depth = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "/" && depth === 0) {
      let end = index + 1;
      while (/\s/.test(value[end] ?? "")) end++;
      for (let inner = 0; end < value.length; end++) {
        if (value[end] === "(") inner++;
        else if (value[end] === ")") inner--;
        else if (inner === 0 && /[\s,]/.test(value[end])) break;
      }
      return `${value.slice(0, index)} ${value.slice(end)}`;
    }
  }
  return value;
}

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
    return `"${token}": use a theme color (bg-overlay for a backdrop, bg-background, text-foreground); a value that must stay white or black says why in an abnormal-allow comment.`;
  if (fontSize.test(utility)) return `"${token}": use the type scale (text-2xs, text-xs … text-display-lg).`;
  const space = utility.match(spacing);
  if (space) {
    const px = Number(space[1]) * (space[2] === "rem" ? 16 : 1);
    if (px >= 3 && Number.isInteger(px))
      return `"${token}": use a spacing step (${token.replace(/\[[^\]]*\](?=!?$)/, String(px / 4))}), so the density reaches it.`;
  }
  const corner = utility.match(radius);
  const cornerPx = corner && Number(corner[2]) * (corner[3] === "rem" ? 16 : 1);
  if (corner && (corner[1] || (cornerPx > 2 && cornerPx < 999)))
    return `"${token}": use rounded-chip, rounded-control, rounded-mark, rounded-panel or rounded-dialog.`;
  if (shadow.test(utility)) return `"${token}": use shadow-panel or shadow-popover.`;
  const layer = utility.match(zNumber);
  if (layer && Number(layer[1] ?? layer[2]) >= 10)
    return `"${token}": use the stacking scale (z-raised, z-sticky, z-header, z-chrome, z-overlay, z-floating, z-skip-link).`;
  const named = utility.match(tracking);
  if (named) return `"${token}": use tracking-${trackingName[named[1]]}.`;
  return undefined;
}

/** The lines an `abnormal-allow` comment covers: the lines it spans and the one after it. */
function allowedLines(sourceCode) {
  const comments = typeof sourceCode.getAllComments === "function" ? sourceCode.getAllComments() : sourceCode.comments;
  const lines = new Set();
  for (const comment of comments ?? []) {
    if (!(comment.value ?? sourceCode.getText(comment)).includes("abnormal-allow")) continue;
    for (let line = comment.loc.start.line; line <= comment.loc.end.line + 1; line++) lines.add(line);
  }
  return lines;
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
    const allowed = allowedLines(context.sourceCode);
    function checkString(node, value) {
      if (value.length > 4000 || !value.includes("-") || allowed.has(node.loc.start.line)) return;
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
          if (literalColor.test(bareValue(node.value)) && !allowed.has(node.loc.start.line))
            context.report({ node, message: `"${node.value}": use var(--token) for a color in a style object.` });
          return;
        }
        if (node.parent?.type === "ImportDeclaration" || node.parent?.type === "ExportNamedDeclaration") return;
        checkString(node, node.value);
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        const literal = node.parent;
        // A backtick string with nothing interpolated is the same value in a style object as a quoted one.
        if (
          literal.type === "TemplateLiteral" &&
          literal.expressions.length === 0 &&
          literal.parent?.type === "Property" &&
          literal.parent.value === literal &&
          inStyleAttribute(literal)
        ) {
          if (literalColor.test(bareValue(text)) && !allowed.has(node.loc.start.line))
            context.report({ node, message: `"${text}": use var(--token) for a color in a style object.` });
          return;
        }
        checkString(node, text);
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
    const allowed = allowedLines(context.sourceCode);
    return {
      Declaration(node) {
        const property = node.property.toLowerCase();
        if (property.startsWith("--") || allowed.has(node.loc.start.line)) return;
        const value = context.sourceCode.getText(node.value);
        const report = (message) => context.report({ node, message: `${property}: ${value.trim()}: ${message}` });
        const bare = bareValue(value);
        if (literalColor.test(bare)) return report("use var(--token) instead of a literal color.");
        const length = /(?:^|[\s(,+*/-])\+?\d*\.?\d+(?:px|rem)\b/i;
        const fixedSize =
          property === "font-size"
            ? length.test(bare) && !/var\(|clamp\(/i.test(bare)
            : // In the shorthand the size may come from var() or clamp(); the line height after the slash is not a size.
              property === "font" && length.test(withoutCalls(withoutLineHeight(bare), "var|clamp"));
        if (fixedSize) return report("use var(--text-*) from the type scale.");
        if (SPACING_CSS.test(property)) {
          const large = [...bare.matchAll(/(?<![\w.-])-?(\d*\.?\d+)px\b/gi)].some(([, n]) => Number(n) >= 3);
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
