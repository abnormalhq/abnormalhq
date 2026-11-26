import { Marker } from "@/components/ui/marker";

/**
 * A headline's line with its one word under the highlighter: the public pages' one stroke of yellow. At display sizes
 * the stroke is a band under the word rather than through it, in full yellow, so it reads on the ink as on paper and
 * the light text above it keeps its contrast.
 */
export function MarkedLine({ line, marked }: { line: string; marked: string }) {
  const at = line.indexOf(marked);
  if (at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <Marker className="bg-[linear-gradient(transparent_84%,var(--highlight)_84%_96%,transparent_96%)] px-0">
        {marked}
      </Marker>
      {line.slice(at + marked.length)}
    </>
  );
}
