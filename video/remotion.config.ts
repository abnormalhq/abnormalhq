import { Config } from "@remotion/cli/config";

// 字体直接用官网自托管的那几份（public/fonts/），不再复制一份。
Config.setPublicDir("../public");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 画面是平涂的动态图形，这个质量下 1080p 文件很小；封面图同一个质量。
Config.setCrf(24);
Config.setJpegQuality(88);
// 不想让 Remotion 另下载一份 Chrome 时（如 CI 或沙箱里已有 Chromium），用环境变量指定浏览器。
if (process.env.REMOTION_BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
