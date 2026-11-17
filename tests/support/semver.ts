type Version = [number, number, number];

/**
 * Whether `version` (x.y.z) is in an npm range, for the subset package.json fields use: `||` alternatives of
 * space-separated comparators (`>=`, `>`, `<=`, `<`, `=`, `^`, `~` or a bare version, partial versions and `x`
 * allowed). Any other syntax (prereleases, hyphen ranges) throws, so a test fails instead of passing unchecked.
 */
export function satisfies(version: string, range: string): boolean {
  const actual = version
    .match(/^v?(\d+)\.(\d+)\.(\d+)$/)
    ?.slice(1)
    .map(Number) as Version | undefined;
  if (!actual) throw new Error(`not a release version: ${version}`);
  // map before some/every: every comparator is read, so unsupported syntax throws wherever it is in the range.
  const sets = range.split("||").map((set) =>
    set
      .trim()
      .replace(/([<>=^~]+)\s+/g, "$1")
      .split(/\s+/)
      .filter(Boolean)
      .map((comparator) => matches(actual, comparator)),
  );
  return sets.some((set) => set.every(Boolean));
}

function matches(actual: Version, comparator: string): boolean {
  const match = comparator.match(/^(>=|<=|>|<|=|\^|~)?v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/);
  if (!match) throw new Error(`unsupported range: ${comparator}`);
  const [, operator = "="] = match;
  const parts: number[] = [];
  for (const part of match.slice(2)) {
    if (part === undefined || !/^\d+$/.test(part)) break;
    parts.push(Number(part));
  }
  if (parts.length === 0) {
    if (operator === "<" || operator === ">") throw new Error(`unsupported range: ${comparator}`);
    return true;
  }
  const floor = [parts[0], parts[1] ?? 0, parts[2] ?? 0] as Version;
  const full = parts.length === 3;
  // The first version past a partial (or caret, tilde) range: bump the part at `index`, zero the rest.
  const next = (index: number) => floor.map((part, i) => (i < index ? part : i === index ? part + 1 : 0)) as Version;
  const atLeast = compare(actual, floor) >= 0;
  switch (operator) {
    case ">=":
      return atLeast;
    case "<":
      return !atLeast;
    case ">":
      return full ? compare(actual, floor) > 0 : compare(actual, next(parts.length - 1)) >= 0;
    case "<=":
      return full ? compare(actual, floor) <= 0 : compare(actual, next(parts.length - 1)) < 0;
    case "~":
      return atLeast && compare(actual, next(parts.length > 1 ? 1 : 0)) < 0;
    case "^": {
      const nonZero = parts.findIndex((part) => part > 0);
      return atLeast && compare(actual, next(nonZero === -1 ? parts.length - 1 : nonZero)) < 0;
    }
    default:
      return full ? compare(actual, floor) === 0 : atLeast && compare(actual, next(parts.length - 1)) < 0;
  }
}

function compare([a0, a1, a2]: Version, [b0, b1, b2]: Version): number {
  return a0 - b0 || a1 - b1 || a2 - b2;
}
