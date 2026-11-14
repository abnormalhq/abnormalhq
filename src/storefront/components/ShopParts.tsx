/** Layout shared by the shop pages: page skeleton, panels, notices and order details. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/ui/section-heading";
import { Stepper, StepperContent, StepperIndicator, StepperItem, StepperTitle } from "@/components/ui/stepper";
import { TextLink } from "@/components/ui/text-link";
import { cn } from "@/lib/utils";

export const shopPageClass = "pt-9 max-narrow:pt-[22px]";
export const shopOrderPageClass = cn(shopPageClass, "mx-auto max-w-[780px]");
export const shopHeadingClass = "text-xl max-narrow:text-[18px] max-narrow:leading-[1.4]";
export const shopTextClass = "mt-2.5 text-sm/[1.7] text-muted-foreground";
export const shopInputClass = "h-auto min-h-10 py-2 text-base/body disabled:cursor-default disabled:opacity-100";
export const shopNoteClass = "mt-6 max-w-[800px] text-xs/[1.9] text-muted-foreground";
export const shopHeadingRowClass = "flex flex-wrap items-center justify-between gap-4";
export const shopPriceLineClass = "flex flex-wrap items-baseline gap-2.5";
export const shopPriceAmountClass = "text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]";
export const shopPriceUnitClass = "text-xs/body text-muted-foreground";
export const shopEmptyClass = "block px-7 py-12 text-center";
/** One subscription or order block on the account page; from the second block on there is a thin line above. */
export const shopAccountItemClass = "[&+&]:mt-5 [&+&]:border-t [&+&]:border-border [&+&]:pt-5";

/** Panels and cards rise into place as they appear; the registry's reduced-motion rule leaves them simply shown. */
export const shopArriveClass = "animate-arrive [animation-duration:0.28s]";

export function ShopHero({
  eyebrow,
  title,
  mark,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  /** Shown above the eyebrow: the success mark of a paid order. */
  mark?: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="max-w-[810px] pt-[38px] pb-[46px] max-narrow:pt-7 max-narrow:pb-8">
      {mark && <div className="mb-6">{mark}</div>}
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-[22px] text-[clamp(34px,4.4vw,52px)] leading-[1.15] tracking-[-0.035em] max-narrow:text-[32px] [&:lang(zh)]:tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-5 max-w-[620px] text-md/[1.75] text-muted-foreground max-narrow:text-sm/[1.75]">{children}</p>
    </header>
  );
}

export function ShopTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <TextLink asChild className="min-h-9 gap-0 text-sm/body font-normal">
      <Link href={href}>{children}</Link>
    </TextLink>
  );
}

/** Shop buttons are taller than the registry default: the primary action is solid ink, secondary actions use outline. */
export function ShopButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button size="lg" className={cn("h-auto min-h-10 gap-3 py-2 whitespace-normal", className)} {...props} />;
}

export function ShopPanel({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn("mb-[22px] block p-7 max-narrow:px-5 max-narrow:py-[22px]", className)} {...props} />;
}

export function ShopAlert({ className, ...props }: ComponentProps<typeof Alert>) {
  return (
    <Alert
      variant="destructive"
      className={cn("my-5 block border-destructive/35 bg-destructive/8 px-[18px] text-sm/[1.7]", className)}
      {...props}
    />
  );
}

export function ShopActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-4 max-narrow:gap-3">{children}</div>;
}

/** Order and subscription status: small grey badge whose text turns the success colour once paid or active. */
export function ShopStatus({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <Badge
      className={cn("h-auto w-auto shrink border-0 py-[3px] text-xs/body whitespace-normal", active && "text-success")}
    >
      {children}
    </Badge>
  );
}

/**
 * "Testnet (Nile)" beside a USDT price or payment panel while the shop takes USDT on TRON's test network: what is sent there is
 * test tokens, never real money, so it is marked in the destructive colour where the buyer looks.
 */
export function ShopTestnetBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="h-auto w-auto shrink border-destructive/40 py-[3px] text-xs/body whitespace-normal text-destructive"
    >
      {children}
    </Badge>
  );
}

export function ShopMeta({ children }: { children: ReactNode }) {
  return <dl className="mt-6 border-t border-border pt-[18px] text-xs/body">{children}</dl>;
}

export function ShopMetaRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-5 gap-y-2 py-[5px]">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Order number and redeem code: one click selects all. */
export function ShopOrderCode({ children }: { children: ReactNode }) {
  return <code className="font-[monospace] select-all">{children}</code>;
}

export function ShopMailboxes({ mailboxes }: { mailboxes: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {mailboxes.map((mailbox) => (
        <li className="font-[ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-sm/body" key={mailbox}>
          {mailbox}
        </li>
      ))}
    </ul>
  );
}

/**
 * A labelled field with a hint below. hintId goes on the hint so the control can point at it with aria-describedby; with invalid the hint is the field's error:
 * it turns the error colour and is inserted anew as an alert, so it is read out even when the wording is the rule that was already shown.
 */
export function ShopField({
  htmlFor,
  label,
  hint,
  hintId,
  invalid = false,
  children,
}: {
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 mb-6 grid gap-2">
      <Label className="block text-sm/body font-normal" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {hint !== undefined && (
        <p
          key={invalid ? "error" : "hint"}
          className={cn("max-w-[560px] text-xs/[1.6]", invalid ? "text-destructive" : "text-muted-foreground")}
          id={hintId}
          role={invalid ? "alert" : undefined}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** A grey block standing in for content that is loading; it breathes, and holds still under reduced motion. */
export function ShopSkeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-control bg-control", className)} aria-hidden="true" />;
}

/**
 * Payment went through: a highlighter disc pops in and its check draws itself. Decorative, the heading beside it says
 * the same in words.
 */
export function ShopSuccessMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-12 animate-pop place-items-center rounded-full bg-highlight text-highlight-foreground [animation-duration:0.32s]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path
          className="animate-draw"
          d="M5 12.5l4.5 4.5L19 7.5"
          pathLength={1}
          strokeDasharray={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Where the order is: created, paid, and what the payment gives. The line after a step that has just been completed fills
 * from that step (keyed by status, so it runs again when the order turns paid on the open page).
 */
export function ShopProgress({
  label,
  doneLabel,
  steps,
}: {
  label: string;
  /** "Completed", read out after a finished step's title. */
  doneLabel: string;
  steps: { key: string; title: ReactNode; status: "complete" | "current" | "upcoming" }[];
}) {
  return (
    <Stepper aria-label={label} className="mb-8 max-w-[560px]">
      {steps.map((step, index) => (
        <StepperItem
          key={`${step.key}:${step.status}`}
          status={step.status}
          statusLabel={step.status === "complete" ? doneLabel : undefined}
          className="data-[status=complete]:after:animate-fill-line"
        >
          <StepperIndicator
            className={cn(
              "transition-[background-color,border-color,color] duration-300",
              step.status === "current" && "animate-pop",
            )}
          >
            {index + 1}
          </StepperIndicator>
          <StepperContent>
            <StepperTitle className="text-sm/body transition-colors duration-300">{step.title}</StepperTitle>
          </StepperContent>
        </StepperItem>
      ))}
    </Stepper>
  );
}
