/**
 * Dates and times as the rest of Abnormal writes them (the console, WebMail and the status page): digits and dashes, a 24-hour
 * clock, the same in English and Chinese ("2026-11-14", "2026-11-14 09:05"). A numeric date in a locale's own order ("11/14" in
 * en-US, "14/11" in en-GB) reads month-first to one reader and day-first to another; a spelled-out one differed per language.
 */

let formatter: Intl.DateTimeFormat | null = null;

/** The parts of a moment in the runtime's own time zone (the visitor's, in the browser). */
function parts(at: number): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  formatter ??= new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    // h23, not hour12: false, which some engines write as "24:05" just after midnight.
    hourCycle: "h23",
  });
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(at)) values[part.type] = part.value;
  return values;
}

/** "2026-11-14" for a moment, in the visitor's time zone; null for a value that is no date. */
export function localDate(value: string): string | null {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  const { year, month, day } = parts(at);
  return `${year}-${month}-${day}`;
}

/** "2026-11-14 09:05" for a moment, in the visitor's time zone; null for a value that is no date. */
export function localDateTime(value: string): string | null {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  const { year, month, day, hour, minute } = parts(at);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
