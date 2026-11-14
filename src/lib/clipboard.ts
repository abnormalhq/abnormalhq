/**
 * Writes text to the clipboard, for the `write` of the registry's CopyButton and for any other copy on the site: the Clipboard
 * API where the page has one, else (outside a secure context, or when the browser refuses) a hidden textarea and
 * execCommand("copy"). Throws when neither worked, which CopyButton shows as a failed copy.
 * Every copy on the site passes this as CopyButton's `write`, so the site has one fallback. The registry's CopyButton is gaining
 * the same fallback (unreleased at the time of writing); once the site installs that release, `write` and this helper can go.
 * `container` is where the textarea goes: inside a modal dialog, so the dialog's focus trap lets it be selected. `label` names it.
 */
export async function writeClipboard(
  text: string,
  { container, label }: { container?: HTMLElement | null; label?: string } = {},
): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* Fall back to selection-based copying. */
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  if (label) area.setAttribute("aria-label", label);
  area.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
  (container ?? document.body).append(area);
  area.select();
  area.setSelectionRange(0, area.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    area.remove();
  }
  if (!copied) throw new Error("Copy failed");
}
