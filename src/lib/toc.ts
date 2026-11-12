/**
 * Which section of a document the reader is in, for the table of contents beside it (TocSpy): the last section whose
 * heading has passed `offset` pixels from the top of the viewport. Before the first heading nothing is current; at the
 * very bottom of the page the last section is, so a short closing section can be reached even when its heading never
 * scrolls that far up.
 */
export function currentSection(headingTops: readonly number[], offset: number, atBottom: boolean): number {
  if (headingTops.length === 0) return -1;
  if (atBottom) return headingTops.length - 1;
  let current = -1;
  headingTops.forEach((top, index) => {
    if (top <= offset) current = index;
  });
  return current;
}
