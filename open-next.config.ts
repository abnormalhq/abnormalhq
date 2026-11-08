import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

/**
 * OpenNext configuration for Cloudflare.
 * Every page is prerendered at build time, with no ISR or on-demand revalidation; the prerendered output lives in read-only static assets, so no R2 or queue is needed.
 * The exception is the download page and its Markdown version: they render on the Worker on every request and read the desktop client's release list (src/lib/releases.ts).
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
