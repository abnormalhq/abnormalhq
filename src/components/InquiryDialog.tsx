"use client";

/**
 * The inquiry dialog's context and buttons, on every page. The dialog itself (Radix Dialog and the form, InquiryForm.tsx) is loaded
 * the first time it opens, or as soon as a pointer or focus reaches an inquiry button so it is usually there by the click.
 */
import dynamic from "next/dynamic";
import { Slot } from "radix-ui";
import { createContext, use, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { Lang } from "@/data/site";
import type { Copy } from "@/i18n/types";

type OpenInquiry = (selection: string | undefined, trigger: HTMLElement) => void;

const OpenInquiryContext = createContext<OpenInquiry>(() => {});

/** Starts loading the dialog's module; the import is shared with the dynamic component below, so it loads once. */
function preloadInquiryForm() {
  void import("./InquiryForm");
}

const InquiryForm = dynamic(() => import("./InquiryForm").then((module) => module.InquiryForm), { ssr: false });

/** Wraps a button (asChild style) that opens the inquiry dialog on click; product is the preselected service. */
export function InquiryButton({ product, ...props }: ComponentProps<typeof Slot.Root> & { product?: string }) {
  const openInquiry = use(OpenInquiryContext);
  return (
    <Slot.Root
      {...props}
      onPointerEnter={preloadInquiryForm}
      onFocus={preloadInquiryForm}
      onClick={(event) => openInquiry(product, event.currentTarget as HTMLElement)}
    />
  );
}

export type InquiryProps = {
  lang: Lang;
  copy: Copy["inquiry"];
  dot: string;
  /** Names of the services that can be inquired about. */
  products: readonly string[];
  termsPage: { href: string; label: string };
  privacyPage: { href: string; label: string };
};

export function InquiryProvider({ children, ...props }: InquiryProps & { children: ReactNode }) {
  const { copy, products } = props;
  const [open, setOpen] = useState(false);
  // The dialog's module is requested on the first open, and stays mounted after it so the form keeps what was typed.
  const [opened, setOpened] = useState(false);
  const [product, setProduct] = useState<string>(copy.undecidedProduct);
  const [status, setStatus] = useState("");
  const lastTrigger = useRef<HTMLElement | null>(null);

  const openInquiry: OpenInquiry = (selection, trigger) => {
    lastTrigger.current = trigger;
    const selectable = selection === copy.otherProduct || (selection !== undefined && products.includes(selection));
    setProduct(selectable ? selection : copy.undecidedProduct);
    setStatus("");
    setOpened(true);
    setOpen(true);
  };

  return (
    <OpenInquiryContext value={openInquiry}>
      {children}
      {opened && (
        <InquiryForm
          {...props}
          open={open}
          onOpenChange={setOpen}
          product={product}
          setProduct={setProduct}
          status={status}
          setStatus={setStatus}
          lastTrigger={lastTrigger}
        />
      )}
    </OpenInquiryContext>
  );
}
