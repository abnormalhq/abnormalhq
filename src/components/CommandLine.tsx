import { CodeBlock } from "@/components/ui/code-block";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * An install command (Homebrew, apt) on the download page and in the documentation: the registry's CodeBlock, named by
 * its label, with a CopyButton in the corner. The button has no `text`: it copies the <code> beside it, so the command is
 * in the page once. The block scrolls sideways and takes keyboard focus; the prerendered HTML already carries the command
 * and the button, and only the button is a client component.
 */
export function CommandLine({
  label,
  code,
  copy,
  copied,
  failed,
}: {
  label: string;
  code: string;
  copy: string;
  copied: string;
  /** Said when the browser refuses the clipboard, so the button never does nothing silently. */
  failed: string;
}) {
  return (
    <CodeBlock
      className="mt-5"
      title={label}
      action={<CopyButton label={copy} copiedLabel={copied} failedLabel={failed} />}
    >
      {code}
    </CodeBlock>
  );
}
