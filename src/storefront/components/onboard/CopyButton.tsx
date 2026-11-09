"use client";

import { useEffect, useRef, useState } from "react";
import { InputGroupButton } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { copyText } from "./clipboard";

const COPIED_MS = 1500;

/** The text button inside an input is tightened a little more on phones. */
export const inputActionClass = "max-narrow:px-1.5 max-narrow:text-xs/body";

interface Props {
  /** What to copy; a function is called at click time. */
  text: string | (() => string);
  label: string;
  copiedLabel: string;
  className?: string;
}

/** Quiet text button inside an input: briefly shows "Copied" after a click. */
export function CopyButton({ text, label, copiedLabel, className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy(): Promise<void> {
    const value = typeof text === "function" ? text() : text;
    if (!value || !(await copyText(value))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <InputGroupButton
      className={cn(inputActionClass, "data-copied:text-success", className)}
      data-copied={copied ? "" : undefined}
      onClick={() => void copy()}
    >
      {copied ? copiedLabel : label}
    </InputGroupButton>
  );
}
