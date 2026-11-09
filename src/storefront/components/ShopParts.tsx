/** Layout shared by the shop pages: page skeleton, panels, notices and order details. */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/ui/section-heading";
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

export function ShopHero({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <header className="max-w-[810px] pt-[38px] pb-[46px] max-narrow:pt-7 max-narrow:pb-8">
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

export function ShopField({
  htmlFor,
  label,
  hint,
  hintId,
  children,
}: {
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-5 mb-6 grid gap-2">
      <Label className="block text-sm/body font-normal" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {hint !== undefined && (
        <p className="max-w-[560px] text-xs/[1.6] text-muted-foreground" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
