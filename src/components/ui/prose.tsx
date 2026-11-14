import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Long-form copy such as legal documents, styled through its element tags so it works on rendered MDX.
 * Second-level headings are numbered with a signal-colored counter.
 * Code blocks, tables, quotes and rules are styled too, for documentation rendered from Markdown: a code block is a
 * bordered panel that scrolls sideways, and a table scrolls sideways inside the column instead of widening the page.
 */
function Prose({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prose"
      className={cn(
        "text-md/[1.9] text-muted-foreground [counter-reset:prose-section]",
        "[&_h2]:mt-[3.25rem] [&_h2]:mb-4 [&_h2]:flex [&_h2]:items-baseline [&_h2]:gap-3 [&_h2]:text-xl/[1.5] [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:[counter-increment:prose-section] md:[&_h2]:text-[1.375rem]",
        "[&_h2]:before:text-sm [&_h2]:before:font-medium [&_h2]:before:tracking-normal [&_h2]:before:text-signal [&_h2]:before:content-[counter(prose-section,decimal-leading-zero)]",
        "[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg/[inherit] [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_ol+p]:mt-4 [&_p+p]:mt-4 [&_ul+p]:mt-4",
        "[&_ol]:my-4 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2 [&_ol]:pl-5 [&_ul]:my-4 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5",
        "[&_li]:marker:text-muted-foreground [&_li>p]:m-0",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_a]:wrap-anywhere [&_a]:text-foreground [&_a]:underline [&_a]:decoration-input [&_a]:underline-offset-4 [&_a]:transition-[text-decoration-color] [&_a]:duration-150 [&_a:hover]:decoration-current",
        "[&_code]:rounded-control [&_code]:bg-surface [&_code]:px-[0.4em] [&_code]:py-[0.1em] [&_code]:font-mono [&_code]:text-sm/[inherit] [&_code]:text-foreground",
        // A long inline path or identifier wraps rather than widen the page on a phone.
        "[&_:not(pre)>code]:wrap-anywhere",
        "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-panel [&_pre]:border [&_pre]:border-border [&_pre]:p-4 [&_pre]:text-sm/[1.65] [&_pre]:text-foreground",
        "[&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[length:inherit]",
        "[&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm/[1.55]",
        "[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-foreground",
        "[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
        "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4",
        "[&_hr]:my-8 [&_hr]:border-border",
        className,
      )}
      {...props}
    />
  );
}

export { Prose };
