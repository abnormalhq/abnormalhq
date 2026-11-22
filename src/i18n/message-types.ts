export type MessageTree<T> = T extends string
  ? T
  : T extends (...args: never[]) => unknown
    ? string
    : T extends readonly unknown[]
      ? { [K in keyof T]: MessageTree<T[K]> }
      : T extends object
        ? { [K in keyof T]: MessageTree<T[K]> }
        : T;
