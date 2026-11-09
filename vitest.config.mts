import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * The storefront's tests (tests/storefront/, carried over from the retired onboard repository) run on Vitest; the rest of the site's tests
 * run on node --test (tests/*.test.ts). pnpm test runs both.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    // All are pure logic or Worker tests, so Node is enough.
    environment: "node",
    include: ["tests/storefront/**/*.test.ts"],
    // After each test undo the fetch swapped in by vi.stubGlobal and the console.error from vi.spyOn, so tests do not affect each other.
    unstubGlobals: true,
    restoreMocks: true,
  },
});
