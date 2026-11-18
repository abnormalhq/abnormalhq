import type { WaitlistServices } from "./waitlist";

/** Ephemeral local-review data only. The dev route rejects all non-example.com email addresses. */
export function createWaitlistMock(): WaitlistServices {
  const emails = new Set<string>();
  let windowStart = 0;
  let count = 0;
  return {
    mode: "preview",
    async add(email) {
      if (!email.endsWith("@example.com")) throw new Error("test_addresses_only");
      emails.add(email);
    },
    async limit() {
      const now = Date.now();
      if (now - windowStart >= 60000) {
        windowStart = now;
        count = 0;
      }
      return { success: ++count <= 5 };
    },
  };
}
