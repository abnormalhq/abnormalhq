import { Config } from "@remotion/cli/config";

// Use the site's self-hosted fonts (public/fonts/) directly instead of copying them.
Config.setPublicDir("../public");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The picture is flat motion graphics, so a 1080p file is small at this quality; the poster uses the same quality.
Config.setCrf(24);
// Limited-range BT.709, which every browser decodes the same way. Remotion's default writes full-range frames (yuvj420p), which
// Chromium decodes as limited range: the paper came out a step lighter and the dark film's ink a step darker than the page around it.
Config.setColorSpace("bt709");
Config.setJpegQuality(88);
// To stop Remotion downloading its own Chrome (for example in CI or a sandbox that already has Chromium), name the browser with an environment variable.
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
