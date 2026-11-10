import { pricingMarkdownResponse } from "@/lib/pricing-markdown";

// The catalog is read on every request, so like the HTML pricing page this is not prerendered.
export const dynamic = "force-dynamic";

export function GET() {
  return pricingMarkdownResponse("en");
}
