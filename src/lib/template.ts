declare const slotNames: unique symbol;

/**
 * A copy string with {name} slots, such as "Requests and services are covered by the {terms} and {privacy}.". Slot names the slots its callers fill:
 * fillTemplate then checks at compile time that a component passes exactly those, and tests/i18n.test.ts checks that
 * each language's string uses exactly those. The slot list exists only in the type; at run time it is a plain string.
 */
export type Template<Slot extends string> = string & { readonly [slotNames]?: Slot };

/** The slot names a Template type declares. */
export type TemplateSlot<T> = T extends Template<infer Slot> ? Slot : never;

/**
 * Fills a copy template, swapping each {name} for the given part (usually a link). Spacing and word order stay in each
 * language's copy, so components add no spaces of their own. A name the template uses but the caller does not pass
 * throws. In a server component such as the Footer that fails the prerender, but a client-only string such as the
 * inquiry dialog's legal sentence would only throw in the browser once the dialog opens, which is why the Template
 * type and the i18n test check the names before anything renders.
 */
export function fillTemplate<Slot extends string, T>(template: Template<Slot>, slots: Record<Slot, T>): (string | T)[] {
  const parts: (string | T)[] = [];
  template.split(/\{(\w+)\}/).forEach((part, index) => {
    if (index % 2 === 0) {
      if (part) parts.push(part);
    } else if (Object.hasOwn(slots, part)) {
      parts.push(slots[part as Slot]);
    } else {
      throw new Error(`The copy template "${template}" has no value for {${part}}`);
    }
  });
  return parts;
}
