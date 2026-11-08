/**
 * Release list of the desktop client; the download page uses it to show the current and past versions.
 *
 * The data is desktop/releases.json on downloads.abnormalhq.com, written by the abnormalhq/mail release flow:
 * every version newest first, with latest being the one under desktop/latest/. The download page (and its Markdown version) is not prerendered;
 * it reads this on the Worker on every request, so a new mail release needs no redeploy of the site and shows up within about a minute (see edgeCacheSeconds).
 * Before releases.json existed there was only desktop/latest.json; when the list cannot be read, fall back to it and show only the current version.
 */
import { desktopDownloads } from "../data/site.ts";

export type DesktopPlatform = "macos" | "windows";

export interface DesktopFile {
  platform: DesktopPlatform;
  arch: "universal" | "x64" | "arm64";
  name: string;
  /** Versioned address under desktop/<version>/, which never changes. */
  url: string;
  sha256: string;
  size: number;
}

export interface DesktopRelease {
  version: string;
  /** ISO 8601, UTC. */
  releasedAt: string;
  /** This version's latest.json, listing each file's SHA-256. */
  manifestUrl: string;
  files: DesktopFile[];
}

export interface DesktopReleases {
  current: DesktopRelease;
  /** Versions older than the current one, newest first. */
  previous: DesktopRelease[];
}

const fileOrder = ["macos-universal", "windows-x64", "windows-arm64"];

/** The file's name on the page, the same in both languages. */
export function fileLabel(file: Pick<DesktopFile, "platform" | "arch">): string {
  if (file.platform === "macos") return "macOS";
  return file.arch === "arm64" ? "Windows Arm" : "Windows x64";
}

/** Decimal MB, close to how Finder and Explorer write it, with one decimal place. */
export function formatSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Release date written as 2026-11-07 (UTC), shared by both languages. */
export function releaseDate(release: Pick<DesktopRelease, "releasedAt">): string {
  return release.releasedAt.slice(0, 10);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, what: string): string {
  if (typeof value !== "string" || !value) throw new Error(`desktop releases: ${what} is not a string`);
  return value;
}

function parseFile(value: unknown): DesktopFile | undefined {
  if (!isObject(value)) throw new Error("desktop releases: a file is not an object");
  const platform = value.platform;
  const arch = value.arch;
  // If other platforms or architectures show up later, the download page does not know them yet; skip them rather than fail the whole build.
  if (platform !== "macos" && platform !== "windows") return undefined;
  if (arch !== "universal" && arch !== "x64" && arch !== "arm64") return undefined;
  if (typeof value.size !== "number") throw new Error("desktop releases: a file size is not a number");
  return {
    platform,
    arch,
    name: str(value.name, "a file name"),
    url: str(value.url, "a file URL"),
    sha256: str(value.sha256, "a file SHA-256"),
    size: value.size,
  };
}

function parseRelease(value: unknown): DesktopRelease {
  if (!isObject(value) || !Array.isArray(value.files)) throw new Error("desktop releases: a release has no files");
  const version = str(value.version, "a version");
  const files = value.files
    .map(parseFile)
    .filter((file): file is DesktopFile => file !== undefined)
    .sort((a, b) => fileOrder.indexOf(`${a.platform}-${a.arch}`) - fileOrder.indexOf(`${b.platform}-${b.arch}`));
  return {
    version,
    releasedAt: str(value.released_at, `the release date of ${version}`),
    manifestUrl:
      typeof value.manifest_url === "string"
        ? value.manifest_url
        : desktopDownloads.manifest.replace(/latest\.json$/, `${version}/latest.json`),
    files,
  };
}

/** Parses releases.json: { latest, releases: [...] }, with releases already sorted newest first. */
export function parseReleaseIndex(value: unknown): DesktopReleases {
  if (!isObject(value) || !Array.isArray(value.releases)) throw new Error("desktop releases: no releases list");
  const latest = str(value.latest, "latest");
  const releases = value.releases.map(parseRelease);
  const index = releases.findIndex((release) => release.version === latest);
  if (index === -1) throw new Error(`desktop releases: the latest version ${latest} is not in the list`);
  return { current: releases[index], previous: releases.slice(index + 1) };
}

/** Parses a single version's latest.json, used as the fallback when there is no releases.json. */
export function parseManifest(value: unknown): DesktopReleases {
  return { current: parseRelease(value), previous: [] };
}

/** Both JSON files are max-age=60 on the bucket; cache them at the Cloudflare edge for 60 seconds too, so not every visit goes back to R2. */
const edgeCacheSeconds = 60;

async function getJson(url: string): Promise<unknown> {
  // no-store: Next.js does not cache this request; freshness is decided only by the edge cache below. cf is a Workers fetch option
  // that Node (tests and next dev) ignores. The timeout is short: when the bucket is slow, the page skips the version rather than stall.
  const init = {
    cache: "no-store",
    cf: { cacheEverything: true, cacheTtl: edgeCacheSeconds },
    signal: AbortSignal.timeout(3_000),
  };
  const response = await fetch(url, init as RequestInit);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/**
 * Reads the release list. Uses latest.json when releases.json cannot be read; returns undefined when neither can,
 * in which case the download page still offers the fixed-address download buttons, just without the version number and past releases.
 * The result is not cached in the module: a Worker isolate handles many requests, and a module-level cache would pin the list to the first version read.
 */
export async function fetchDesktopReleases(): Promise<DesktopReleases | undefined> {
  try {
    return parseReleaseIndex(await getJson(desktopDownloads.releases));
  } catch (error) {
    console.warn(`Could not read the desktop release list, falling back to latest.json: ${String(error)}`);
  }
  try {
    return parseManifest(await getJson(desktopDownloads.manifest));
  } catch (error) {
    console.warn(`Could not read the desktop release either; the download page shows no versions: ${String(error)}`);
    return undefined;
  }
}
