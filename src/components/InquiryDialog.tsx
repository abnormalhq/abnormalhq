"use client";

import { Slot } from "radix-ui";
import { createContext, Fragment, use, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { IconTile } from "@/components/ui/icon-tile";
import { NativeSelect } from "@/components/ui/native-select";
import { HeadingMark } from "@/components/ui/section-heading";
import { Textarea } from "@/components/ui/textarea";
import { site, type Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";
import { describeContact, formatInquiry, getContactLink } from "@/lib/inquiry";
import { fillTemplate } from "@/lib/template";
import { Icon } from "./Icon";

type OpenInquiry = (selection: string | undefined, trigger: HTMLElement) => void;

const OpenInquiryContext = createContext<OpenInquiry>(() => {});

const fieldClass = "block min-w-0 text-sm/body font-medium";
const linkClass =
  "underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-current";

/** Wraps a button (asChild style) that opens the inquiry dialog on click; product is the preselected service. */
export function InquiryButton({ product, ...props }: ComponentProps<typeof Slot.Root> & { product?: string }) {
  const openInquiry = use(OpenInquiryContext);
  return <Slot.Root {...props} onClick={(event) => openInquiry(product, event.currentTarget as HTMLElement)} />;
}

async function copyText(text: string, container: HTMLElement, fieldLabel: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Fall back to selection-based copying. */
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("aria-label", fieldLabel);
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
  container.append(field);
  field.select();
  field.setSelectionRange(0, field.value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function InquiryProvider({
  lang,
  copy,
  dot,
  products,
  termsPage,
  privacyPage,
  children,
}: {
  lang: Lang;
  copy: Copy["inquiry"];
  dot: string;
  /** Names of the services that can be inquired about. */
  products: readonly string[];
  termsPage: { href: string; label: string };
  privacyPage: { href: string; label: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<string>(copy.undecidedProduct);
  const [duration, setDuration] = useState<string>(copy.durations[0]!);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const inquiry = { product, duration, notes };
  const contactLink = getContactLink(site.contact, inquiry, lang);

  const openInquiry: OpenInquiry = (selection, trigger) => {
    lastTrigger.current = trigger;
    const selectable = selection === copy.otherProduct || (selection !== undefined && products.includes(selection));
    setProduct(selectable ? selection : copy.undecidedProduct);
    setStatus("");
    setOpen(true);
  };

  return (
    <OpenInquiryContext value={openInquiry}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={content}
          id="inquiry-dialog"
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-40px)] w-[min(560px,calc(100%-34px))] max-w-none flex-col gap-0 overflow-hidden overscroll-contain p-0 sm:max-w-none max-dialog:max-h-[calc(100dvh-24px)] max-dialog:w-[calc(100%-34px)] [@media(max-height:600px)]:block [@media(max-height:600px)]:overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // When the trigger button is no longer visible, focus returns to the mobile menu toggle.
            if (lastTrigger.current?.getClientRects().length) lastTrigger.current.focus();
            else document.querySelector<HTMLElement>('[aria-controls="mobile-nav"]')?.focus();
          }}
        >
          <div className="shrink-0 border-b border-border px-6 pt-5 pb-[22px] max-dialog:px-5 max-dialog:pt-3.5 max-dialog:pb-[18px]">
            <div className="mb-3.5 flex items-center justify-between gap-3 max-dialog:mb-2">
              <span
                className="inline-flex items-center gap-2.5 text-xs/body font-medium tracking-[0.06em] text-muted-foreground uppercase"
                lang="en"
              >
                <IconTile variant="highlight" size="sm">
                  <Icon name="chat" className="size-[18px]" />
                </IconTile>
                {copy.kicker}
              </span>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="-mr-1.5 size-9" aria-label={copy.close}>
                  <Icon name="close" />
                </Button>
              </DialogClose>
            </div>
            <DialogTitle className="text-2xl/[1.3] max-dialog:text-[22px]">
              {copy.title}
              <HeadingMark>{dot}</HeadingMark>
            </DialogTitle>
            <DialogDescription className="mt-2 text-base/[1.75]">
              {copy.description[0]}
              <br />
              {copy.description[1]}
            </DialogDescription>
          </div>
          <form
            className="min-h-0 overflow-y-auto overscroll-contain px-6 pt-[22px] pb-6 [scrollbar-width:thin] max-dialog:p-5 [@media(max-height:600px)]:overflow-visible"
            onChange={() => setStatus("")}
            onSubmit={async (event) => {
              event.preventDefault();
              const container = content.current;
              if (!container) return;
              setCopying(true);
              const copied = await copyText(formatInquiry(inquiry, lang), container, copy.copyFieldLabel);
              // Re-enable first, otherwise the button cannot take focus again.
              flushSync(() => setCopying(false));
              if (container.isConnected) {
                copyButton.current?.focus();
                setStatus(copied ? copy.copied : copy.copyFailed);
              }
            }}
          >
            <div className="mb-5 grid grid-cols-[1.35fr_1fr] gap-3.5 max-dialog:grid-cols-1 max-dialog:gap-[18px]">
              <label className={fieldClass}>
                {copy.productLabel}
                <NativeSelect
                  className="mt-2 h-10 font-normal"
                  name="product"
                  value={product}
                  onChange={(event) => setProduct(event.target.value)}
                >
                  {products.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                  <option>{copy.otherProduct}</option>
                  <option value={copy.undecidedProduct}>{copy.undecidedLabel}</option>
                </NativeSelect>
              </label>
              <label className={fieldClass}>
                {copy.durationLabel}
                <NativeSelect
                  className="mt-2 h-10 font-normal"
                  name="duration"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  {copy.durations.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <label className={fieldClass}>
              {copy.notesLabel} <span className="ml-1 text-xs font-normal text-muted-foreground">{copy.optional}</span>
              <Textarea
                className="mt-2 max-h-44 min-h-[104px] resize-y py-2.5 leading-[1.7] font-normal placeholder:text-xs placeholder:leading-[1.8]"
                name="notes"
                rows={3}
                maxLength={600}
                placeholder={copy.notesPlaceholder}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            <div className="mt-5 rounded-mark border border-border bg-surface px-4 py-3.5">
              <span className="inline-flex items-center gap-[7px] text-xs/body font-medium text-muted-foreground">
                <Icon name="copy" className="size-3.5" />
                {copy.previewLabel}
              </span>
              <p className="mt-1 text-xs leading-loose wrap-anywhere whitespace-pre-wrap">
                {formatInquiry(inquiry, lang)}
              </p>
            </div>
            <div className="mt-4 flex items-start gap-[9px]">
              <Icon name="chat" className="mt-1 size-4 text-muted-foreground" />
              <p className="text-xs leading-loose wrap-anywhere text-muted-foreground">
                {describeContact(site.contact, lang)}
              </p>
            </div>
            <Button className="mt-5 h-11 w-full gap-2" size="lg" ref={copyButton} type="submit" disabled={copying}>
              <Icon name="copy" className="size-4" />
              {copy.copy}
            </Button>
            {contactLink && (
              <Button asChild variant="outline" size="lg" className="mt-2 h-11 w-full gap-2">
                <a
                  href={contactLink.href}
                  rel="noopener noreferrer"
                  target={contactLink.type === "telegram" ? "_blank" : undefined}
                >
                  <span>{contactLink.label}</span>
                  <Icon name="up-right" className="size-4" />
                </a>
              </Button>
            )}
            <p className="mt-[18px] text-center text-xs/prose text-muted-foreground">
              {copy.note}
              <br />
              {fillTemplate(copy.legal, {
                terms: termsPage,
                privacy: privacyPage,
              }).map((part, index) =>
                typeof part === "string" ? (
                  <Fragment key={index}>{part}</Fragment>
                ) : (
                  <a className={linkClass} href={part.href} target="_blank" rel="noopener noreferrer" key={index}>
                    {part.label}
                    <span className="sr-only">{copy.newWindow}</span>
                  </a>
                ),
              )}
            </p>
            <p
              className="mt-2 text-center text-xs leading-relaxed text-foreground empty:mt-0"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </OpenInquiryContext>
  );
}
