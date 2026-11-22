export type MessageTranslator = {
  (key: string, values?: Record<string, string | number | boolean>): string;
  raw(key: string): unknown;
};

export type DynamicMessageFormatters = Record<
  string,
  (translator: MessageTranslator, args: readonly unknown[]) => string
>;

export function createTranslationFacade<T>(
  translator: MessageTranslator,
  source: Record<string, unknown>,
  formatters: DynamicMessageFormatters = {},
): T {
  const materialize = (path: string): unknown => {
    const formatter = formatters[path];
    if (formatter) return (...args: unknown[]) => formatter(translator, args);

    const value = translator.raw(path);
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).map((key) => [key, materialize(`${path}.${key}`)]));
    }
    return value;
  };

  return Object.fromEntries(Object.keys(source).map((key) => [key, materialize(key)])) as T;
}
