/**
 * Worker 入口：在 OpenNext 生成的 Worker 外面做 Markdown 内容协商与语言跳转，并修正响应的缓存头。
 * next.config 的 rewrites 只能用正则匹配 Accept，比较不了权重；OpenNext 写死的缓存头也只有这一层能改。
 * 语言跳转（src/lib/lang.ts）要看 cookie 与 Accept-Language，预渲染的页面做不到，也只能放在这一层。
 */
import handler from "./.open-next/worker.js";
import { revalidateInBrowser } from "./src/lib/cache.ts";
import { languageRedirect } from "./src/lib/lang.ts";
import { markdownUrl, varyOnAccept } from "./src/lib/negotiate.ts";

const worker = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const markdown = markdownUrl(request);
    if (markdown) {
      // 要 Markdown 的是 Agent，地址里的语言就是它要的语言，不按 cookie 或浏览器语言改。
      return revalidateInBrowser(varyOnAccept(await handler.fetch(new Request(markdown, request), env, ctx)));
    }
    return languageRedirect(request) ?? revalidateInBrowser(await handler.fetch(request, env, ctx));
  },
};

export default worker;
