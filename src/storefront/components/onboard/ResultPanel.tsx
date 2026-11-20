"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { REDEEM_PATH, type Copy } from "@/storefront/i18n";
import type { ServerEndpoint } from "@/storefront/lib/api";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DescriptionDetails,
  DescriptionItem,
  DescriptionList,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { InputGroupButton } from "@/components/ui/input-group";
import { Eyebrow } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { inputActionClass } from "./AccountRow";
import { Msg } from "./Msg";
import { NO_NOTE, note, type Issued, type Outcome } from "./reducer";

const MASK = "••••••••••••";

const noteClass = "mt-5 text-sm/[1.7] text-pretty text-muted-foreground";
const credsLabelClass = "text-sm/body text-muted-foreground";
const credsValueClass = "min-w-0 text-base/body wrap-anywhere";
const issuedRowClass = "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 wrap-anywhere";
/** Buttons in the activated list are 40px tall, easier to hit. */
const issuedActionClass = "min-h-10";

export const panelClass =
  "block px-8 py-[30px] max-desk:px-6 max-desk:py-[26px] max-narrow:rounded-mark max-narrow:px-[18px] max-narrow:py-[22px]";

interface Props {
  t: Copy;
  issued: Issued[];
  outcome: Outcome | null;
  supportEmail: string;
  /** The language root (/ or /zh/): copy links are relative to it, and "Redeem again" returns to its redeem page with a full reload, so the credentials leave memory too. */
  homePath: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/** The result after activation: the mailbox address as heading, then the list of activated mailboxes and a hairline-separated credentials table. */
export function ResultPanel({ t, issued, outcome, supportEmail, homePath, titleRef }: Props) {
  const notification = outcome?.notification ?? null;
  // When the backend has no webmail configured the entry is not shown, so users are not sent to an unrelated mail service.
  const webmail = outcome?.webmail ?? null;
  // The passwords on this panel are shown once and nowhere else unless a copy was emailed. Until then, a reload, a closed
  // tab or a link followed in this tab (the guide) would lose them silently, so the browser asks first. "Redeem again"
  // leaves on purpose and is let through; webmail opens in a new tab and leaves this one as it is.
  // Same-document Next.js <Link> navigations do not fire beforeunload: catch those clicks too.
  const unsaved = issued.length > 0 && !notification?.sent;
  const leaving = useRef(false);
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      // Older browsers ask only when returnValue is set; its text is never shown.
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || target.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(target.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(t.result.leaveUnsaved)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [unsaved, t.result.leaveUnsaved]);
  return (
    <Card
      className={cn(panelClass, "mt-6 [div[hidden]+&]:mt-0")}
      hidden={issued.length === 0}
      aria-labelledby="result-title"
    >
      <div className="flex items-start gap-4 max-narrow:gap-3">
        <span
          className="grid size-[46px] shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--success)_10%,var(--card))] text-success max-narrow:size-9"
          aria-hidden="true"
        >
          <CheckIcon className="size-7 max-narrow:size-[22px]" />
        </span>
        <div className="min-w-0">
          <Eyebrow className="text-success before:hidden">{t.result.eyebrow}</Eyebrow>
          <h2
            className="mt-2.5 text-[clamp(24px,2.6vw,32px)] leading-[1.25] tracking-[-0.025em] wrap-anywhere focus-visible:rounded-[3px] focus-visible:outline-offset-[6px] max-narrow:text-[22px]"
            id="result-title"
            tabIndex={-1}
            ref={titleRef}
          >
            {issued.length === 1 ? issued[0]!.email : issued.length > 1 ? t.result.title(issued.length) : null}
          </h2>
          <p className="mt-2.5 text-sm/[1.7] text-muted-foreground">{t.submitNote}</p>
        </div>
      </div>
      <ul className="mt-[26px] border-t border-border">
        {issued.map((item) => (
          <IssuedItem key={item.email} t={t} item={item} />
        ))}
      </ul>
      <p className="mt-2" hidden={issued.length < 2}>
        <CopyButton
          size="sm"
          label={t.buttons.copyAll}
          copiedLabel={t.buttons.copied}
          failedLabel={t.buttons.copyFailed}
          text={issued.map((item) => `${item.email}\t${item.password}`).join("\n")}
        >
          {t.buttons.copyAll}
        </CopyButton>
      </p>
      <Msg
        className="mt-5"
        hidden={!notification}
        note={
          notification
            ? note(
                notification.sent
                  ? t.result.notified(notification.to)
                  : t.result.notifyFailed(notification.to, notification.error),
                notification.sent ? "ok" : "error",
              )
            : NO_NOTE
        }
      />
      {/* The registry's lined list: values in one column with a hairline between rows, under their names on a phone. */}
      <DescriptionList variant="lined" className="mt-6 gap-x-5 border-y border-border">
        <DescriptionItem>
          <DescriptionTerm className={credsLabelClass}>{t.result.login}</DescriptionTerm>
          <DescriptionDetails className={credsValueClass}>
            <small className="text-xs/body text-muted-foreground">{t.result.loginNote}</small>
          </DescriptionDetails>
        </DescriptionItem>
        <Endpoint t={t} label={t.result.imap} endpoint={outcome?.imap ?? null} />
        <Endpoint t={t} label={t.result.smtp} endpoint={outcome?.smtp ?? null} />
      </DescriptionList>
      <Button asChild size="lg" className="mt-6 h-auto min-h-10 py-2 whitespace-normal">
        <a href={webmail ?? "#"} target="_blank" rel="noopener noreferrer" hidden={!webmail}>
          {t.buttons.openWebmail}
        </a>
      </Button>
      <p className={noteClass}>
        {t.result.note[0]}
        <TextLink variant="inline" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </TextLink>
        {t.result.note[1]}
      </p>
      <p className={noteClass}>
        <RichText text={t.result.next} base={homePath} inlineLinks />
      </p>
      <p>
        <TextLink
          className="mt-[18px] min-h-10 text-sm/body font-normal"
          href={`${homePath}${REDEEM_PATH}`}
          onClick={() => {
            leaving.current = true;
          }}
        >
          <span aria-hidden="true">←</span> {t.result.again}
        </TextLink>
      </p>
    </Card>
  );
}

function Endpoint({ t, label, endpoint }: { t: Copy; label: string; endpoint: ServerEndpoint | null }) {
  return (
    <DescriptionItem hidden={!endpoint}>
      <DescriptionTerm className={credsLabelClass}>{label}</DescriptionTerm>
      <DescriptionDetails className={credsValueClass}>
        <span>
          {endpoint
            ? `${endpoint.host} · ${t.result.port} ${endpoint.port} · ${t.result.security[endpoint.security]}`
            : null}
        </span>
      </DescriptionDetails>
    </DescriptionItem>
  );
}

/** One activated mailbox: the address can be copied, the password is hidden by default and can be shown or copied. */
function IssuedItem({ t, item }: { t: Copy; item: Issued }) {
  const [masked, setMasked] = useState(true);
  return (
    <li className="grid gap-1.5 border-b border-border py-3.5">
      <span className={cn(issuedRowClass, "text-md/body font-medium max-narrow:text-base/body")}>
        <span className="min-w-0 wrap-anywhere">{item.email}</span>
        <CopyButton
          size="sm"
          className={issuedActionClass}
          label={t.buttons.copy}
          copiedLabel={t.buttons.copied}
          failedLabel={t.buttons.copyFailed}
          text={item.email}
        >
          {t.buttons.copy}
        </CopyButton>
      </span>
      <span
        className={cn(
          issuedRowClass,
          "rounded-control border border-input bg-control py-0.5 pr-1 pl-2.5 font-mono text-base/body",
        )}
      >
        <span
          className="mr-auto min-w-0 wrap-anywhere data-[masked=true]:tracking-[0.12em]"
          data-masked={String(masked)}
        >
          {masked ? MASK : item.password}
        </span>
        <InputGroupButton
          className={cn(inputActionClass, issuedActionClass)}
          aria-pressed={!masked}
          onClick={() => setMasked((value) => !value)}
        >
          {masked ? t.buttons.show : t.buttons.hide}
        </InputGroupButton>
        <CopyButton
          size="sm"
          className={issuedActionClass}
          label={t.buttons.copy}
          copiedLabel={t.buttons.copied}
          failedLabel={t.buttons.copyFailed}
          text={item.password}
        >
          {t.buttons.copy}
        </CopyButton>
      </span>
    </li>
  );
}
