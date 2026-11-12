/**
 * Which download fits the visitor (the download page's "For this computer" badge and phone note, DownloadHint). Read in the
 * browser only: the page is rendered on the Worker for every visitor alike, so it must not depend on who asked.
 */
export type DesktopPlatform = "macos" | "windows" | "linux";
export type VisitorDevice = DesktopPlatform | "phone";

export interface DeviceSignals {
  userAgent: string;
  /** navigator.userAgentData, where the browser has it (Chromium): platform name and whether it is a phone or tablet. */
  userAgentData?: { platform?: string; mobile?: boolean };
  /** iPadOS asks for desktop sites and reports a Mac user agent; touch points tell the two apart. */
  maxTouchPoints?: number;
}

/** null when the system is unknown or has no download (ChromeOS, other): then the page simply recommends nothing. */
export function detectDevice({ userAgent, userAgentData, maxTouchPoints = 0 }: DeviceSignals): VisitorDevice | null {
  if (userAgentData?.mobile) return "phone";
  if (/iPhone|iPad|iPod|Android/i.test(userAgent)) return "phone";
  const platform = userAgentData?.platform?.toLowerCase() ?? "";
  if (platform === "macos" || /Macintosh|Mac OS X/.test(userAgent)) return maxTouchPoints > 1 ? "phone" : "macos";
  if (platform === "windows" || /Windows/.test(userAgent)) return "windows";
  if (platform === "chrome os" || platform === "chromeos" || /CrOS/.test(userAgent)) return null;
  if (platform === "linux" || /Linux/.test(userAgent)) return "linux";
  return null;
}
