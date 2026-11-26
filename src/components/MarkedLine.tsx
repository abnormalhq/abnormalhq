import { Marker } from "@/components/ui/marker";

/**
 * A headline's line with its one word under the highlighter: the public pages' one stroke of yellow. On warm paper
 * the stroke sits behind the lower half of the word like a real marker; on dark ink it narrows to an underline so
 * light serif text keeps full contrast.
 */
export function MarkedLine({ line, marked }: { line: string; marked: string }) {
  const at = line.indexOf(marked);
  if (at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <Marker className="bg-[linear-gradient(transparent_var(--mark-from),var(--highlight)_var(--mark-from)_var(--mark-to),transparent_var(--mark-to))] px-[0.06em] [--mark-from:60%] [--mark-to:92%] dark:px-0 dark:[--mark-from:84%] dark:[--mark-to:95%] [.ink_&]:px-0 [.ink_&]:[--mark-from:84%] [.ink_&]:[--mark-to:95%]">
        {marked}
      </Marker>
      {line.slice(at + marked.length)}
    </>
  );
}
