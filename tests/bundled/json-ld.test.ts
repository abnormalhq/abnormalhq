import { expect, test } from "vitest";
import { serializeJsonLd } from "@/components/ui/json-ld";

// The pages write structured data through the registry's JsonLd; the copy must not be able to end its script element.
test("serialized JSON-LD cannot close its script tag", () => {
  const text = serializeJsonLd({ answer: "</script><script>alert(1)</script>" });
  expect(text).not.toContain("<");
  expect(JSON.parse(text)).toEqual({ answer: "</script><script>alert(1)</script>" });
});
