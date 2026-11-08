import { downloadMarkdownResponse } from "@/lib/markdown";

// The release list is read on every request, so like the HTML download page this is not prerendered.
export const dynamic = "force-dynamic";

export function GET() {
  return downloadMarkdownResponse("zh");
}
