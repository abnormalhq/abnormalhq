"use client";

import { useState } from "react";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

/**
 * A whole number inside a range, with a button on either side: how many mailboxes to buy, add or remove. The field is a native
 * number input (a spinbutton to assistive technology, with the arrow keys and the numeric keypad on phones); the buttons are
 * named by the caller in the page's language, and stop at the ends of the range. What is typed is kept as typed until the field
 * loses focus, then brought into the range, so "1" on the way to "12" is not corrected mid-word.
 */
export function ShopSeatStepper({
  id,
  value,
  min,
  max,
  onChange,
  disabled = false,
  fewerLabel,
  moreLabel,
  describedBy,
  className,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  fewerLabel: string;
  moreLabel: string;
  describedBy?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const clamp = (next: number) => (Number.isFinite(next) ? Math.min(max, Math.max(min, Math.trunc(next))) : min);

  function set(next: number) {
    const clamped = clamp(next);
    setDraft(String(clamped));
    onChange(clamped);
  }

  const buttonClass = "min-w-9 text-md/[1] text-foreground";
  return (
    <InputGroup size="lg" className={cn("w-fit", className)}>
      <InputGroupButton
        className={cn(buttonClass, "ml-1")}
        aria-label={fewerLabel}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
      >
        <span aria-hidden="true">−</span>
      </InputGroupButton>
      <InputGroupInput
        id={id}
        className="w-[4.5rem] flex-none [appearance:textfield] px-1 text-center tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const typed = Number(raw);
          if (raw.trim() !== "" && Number.isSafeInteger(typed) && typed >= min && typed <= max) onChange(typed);
        }}
        onBlur={() => set(Number(draft))}
      />
      <InputGroupButton
        className={buttonClass}
        aria-label={moreLabel}
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
      >
        <span aria-hidden="true">+</span>
      </InputGroupButton>
    </InputGroup>
  );
}
