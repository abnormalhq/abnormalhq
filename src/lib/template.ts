declare const slotNames: unique symbol;

/**
 * A copy string with {name} slots, such as "Requests are covered by the {terms} and {privacy}.". Slot names the slots
 * its callers fill: fillTemplate then checks at compile time that a component passes exactly those, and a project's
 * i18n test can check that each language's string uses exactly those. The slot list exists only in the type; at run
 * time it is a plain string.
 */
export type Template<Slot extends string> = string & { readonly [slotNames]?: Slot };

/** The slot names a Template type declares. */
export type TemplateSlot<T> = T extends Template<infer Slot> ? Slot : never;

/**
 * Fills a copy template, swapping each {name} (letters, digits, _ and -) for the given part (a string, or a link or any other node). Spacing and
 * word order stay in each language's copy, so components add no spaces of their own. A name the template uses but the
 * caller does not pass throws: in a server component that fails the prerender, but in a client-only string it would
 * only throw in the browser, which is why the Template type checks the names before anything renders.
 */
export function fillTemplate<Slot extends string, T>(template: Template<Slot>, slots: Record<Slot, T>): (string | T)[] {
  const parts: (string | T)[] = [];
  template.split(/\{([\w-]+)\}/).forEach((part, index) => {
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
