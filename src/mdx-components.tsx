import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {};

/** @next/mdx requires this file under the App Router; the legal documents use the default elements, styled by @abnormal/prose. */
export function useMDXComponents(): MDXComponents {
  return components;
}
