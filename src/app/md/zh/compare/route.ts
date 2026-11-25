import { compareMarkdownResponse } from "@/lib/pricing-markdown";

// Abnormal Mail's storage, trial and own domains come from the live catalog, so like the HTML page this is not prerendered.
export const dynamic = "force-dynamic";

export function GET() {
  return compareMarkdownResponse("zh");
}
