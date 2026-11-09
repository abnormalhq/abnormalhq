"use client";

import { useState, type RefObject } from "react";
import { REDEEM_PATH, type Copy } from "@/storefront/i18n";
import type { ServerEndpoint } from "@/storefront/lib/api";
import { cn } from "@/lib/utils";
import { RichText, inlineLinkClass } from "@/storefront/components/RichText";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroupButton } from "@/components/ui/input-group";
import { Eyebrow } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import { CopyButton, inputActionClass } from "./CopyButton";
import { Msg } from "./Msg";
import { NO_NOTE, note, type Issued, type Outcome } from "./reducer";

const MASK = "••••••••••••";

const noteClass = "mt-5 text-sm/[1.7] text-pretty text-muted-foreground";
const credsRowClass =
  "grid grid-cols-[110px_minmax(0,1fr)] items-center gap-5 border-b border-border py-[15px] max-narrow:grid-cols-[1fr] max-narrow:gap-1.5";
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
          <svg
            className="max-narrow:size-[22px]"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
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
          label={t.buttons.copyAll}
          copiedLabel={t.buttons.copied}
          text={() => issued.map((item) => `${item.email}\t${item.password}`).join("\n")}
        />
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
      <dl className="mt-6 border-t border-border">
        <div className={credsRowClass}>
          <dt className={credsLabelClass}>{t.result.login}</dt>
          <dd className={credsValueClass}>
            <small className="text-xs/body text-muted-foreground">{t.result.loginNote}</small>
          </dd>
        </div>
        <Endpoint t={t} label={t.result.imap} endpoint={outcome?.imap ?? null} />
        <Endpoint t={t} label={t.result.smtp} endpoint={outcome?.smtp ?? null} />
      </dl>
      <Button asChild size="lg" className="mt-6 h-auto min-h-10 py-2 whitespace-normal">
        <a href={webmail ?? "#"} target="_blank" rel="noopener noreferrer" hidden={!webmail}>
          {t.buttons.openWebmail}
        </a>
      </Button>
      <p className={noteClass}>
        {t.result.note[0]}
        <a className={inlineLinkClass} href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        {t.result.note[1]}
      </p>
      <p className={noteClass}>
        <RichText text={t.result.next} base={homePath} linkClassName={inlineLinkClass} />
      </p>
      <p>
        <TextLink className="mt-[18px] min-h-10 text-sm/body font-normal" href={`${homePath}${REDEEM_PATH}`}>
          <span aria-hidden="true">←</span> {t.result.again}
        </TextLink>
      </p>
    </Card>
  );
}

function Endpoint({ t, label, endpoint }: { t: Copy; label: string; endpoint: ServerEndpoint | null }) {
  return (
    <div className={credsRowClass} hidden={!endpoint}>
      <dt className={credsLabelClass}>{label}</dt>
      <dd className={credsValueClass}>
        <span>
          {endpoint
            ? `${endpoint.host} · ${t.result.port} ${endpoint.port} · ${t.result.security[endpoint.security]}`
            : null}
        </span>
      </dd>
    </div>
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
          className={issuedActionClass}
          label={t.buttons.copy}
          copiedLabel={t.buttons.copied}
          text={item.email}
        />
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
          className={issuedActionClass}
          label={t.buttons.copy}
          copiedLabel={t.buttons.copied}
          text={item.password}
        />
      </span>
    </li>
  );
}
