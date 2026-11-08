import { Config } from "@remotion/cli/config";

// Use the site's self-hosted fonts (public/fonts/) directly instead of copying them.
Config.setPublicDir("../public");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The picture is flat motion graphics, so a 1080p file is small at this quality; the poster uses the same quality.
Config.setCrf(24);
Config.setJpegQuality(88);
// To stop Remotion downloading its own Chrome (for example in CI or a sandbox that already has Chromium), name the browser with an environment variable.
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
