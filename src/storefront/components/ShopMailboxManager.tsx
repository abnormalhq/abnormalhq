"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupButton, InputGroupInput, InputGroupSuffix } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import { generatePassword, normalizeUsername, passwordProblem, usernameProblem } from "@/storefront/lib/onboard";
import {
  createAccountMailbox,
  deleteAccountMailbox,
  getAccountMailboxes,
  setAccountMailboxPassword,
  setAccountMailboxStatus,
  type AccountMailbox,
  type AccountMailboxGroup,
  type AccountMailboxes,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { CopyButton, inputActionClass } from "./onboard/CopyButton";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopField,
  ShopMeta,
  ShopMetaRow,
  ShopOrderCode,
  ShopPanel,
  ShopStatus,
  shopAccountItemClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopTextClass,
} from "./ShopParts";

/** The action open on one mailbox: only one at a time on the page. */
type Open = { mailboxId: string; kind: "password" | "delete" } | { orderId: string; kind: "create" } | null;

/** A mailbox just set up: its password is shown this once, like on the redeem page. */
interface Created {
  orderId: string;
  email: string;
  password: string;
}

/**
 * "My mailboxes": like Spacemail Manager, lists the mailboxes activated with the buyer's own redeem codes per order, and lets them activate new mailboxes, reset mailbox passwords, suspend / resume and delete directly.
 * The rules all live in mail (src/lib/shop/customer-mailboxes.ts): this only shows its answers and re-reads the list after every change.
 * When the subscription is suspended the whole group is read-only; deleting requires typing the full mailbox address.
 */
export function ShopMailboxManager({ lang }: { lang: Lang }) {
  const t = shopCopy[lang];
  // undefined: still loading; null: unavailable (logged out or old backend), this block is hidden.
  const [data, setData] = useState<AccountMailboxes | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAccountMailboxes(controller.signal, lang)
      .then((next) => {
        if (!controller.signal.aborted) setData(next);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        // Old backends without this endpoint (404) hide this block; other failures show the reason and keep the retry.
        setData((current) => current ?? null);
        setError(shopError(cause, lang));
      });
    return () => controller.abort();
  }, [lang, reload]);

  /** Run one change: on success close the form, show the result and re-read the list; on failure keep the form and show the reason. */
  async function act(work: () => Promise<string | void>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    // The new password is shown only once, right after activation: any other action (including deleting that mailbox) hides it.
    setCreated(null);
    try {
      const message = await work();
      if (!mounted.current) return false;
      setOpen(null);
      if (message) setNotice(message);
      setReload((value) => value + 1);
      return true;
    } catch (cause) {
      if (mounted.current) setError(shopError(cause, lang));
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  if (data === null && !error) return null;

  return (
    <ShopPanel>
      <div className={shopHeadingRowClass}>
        <h2 className={shopHeadingClass}>{t.mailboxesTitle}</h2>
        {data?.webmail && (
          <ShopButton asChild variant="outline">
            <a href={data.webmail} target="_blank" rel="noreferrer">
              {t.openWebmail}
              <span aria-hidden="true">↗</span>
            </a>
          </ShopButton>
        )}
      </div>
      <p className={shopTextClass}>{t.mailboxesHint}</p>
      {error && <ShopAlert className="mt-4">{error}</ShopAlert>}
      {notice && (
        <p className="mt-4 text-sm/[1.7]" role="status">
          {notice}
        </p>
      )}
      {data === undefined ? (
        <p className={shopTextClass} role="status">
          {t.loading}
        </p>
      ) : data === null ? null : data.groups.length === 0 ? (
        <p className={shopTextClass}>
          {t.mailboxesEmpty}{" "}
          <Link className="text-foreground underline underline-offset-4" href={`/${LANG_PATHS[lang]}shop/`}>
            {t.mailboxesGoShop}
          </Link>
        </p>
      ) : (
        <div className="mt-6">
          {data.groups.map((group) => (
            <MailboxGroup
              key={group.orderId}
              lang={lang}
              group={group}
              open={open}
              busy={busy}
              created={created?.orderId === group.orderId ? created : null}
              onOpen={(next) => {
                setOpen(next);
                setError("");
              }}
              onCreate={(input) =>
                act(async () => {
                  const result = await createAccountMailbox({ orderId: group.orderId, ...input }, lang);
                  setCreated({ orderId: group.orderId, email: result.email, password: input.password });
                })
              }
              onPassword={(mailbox, password) =>
                act(async () => {
                  await setAccountMailboxPassword(mailbox.id, password, lang);
                  return t.mailboxPasswordSaved(mailbox.email);
                })
              }
              onStatus={(mailbox) =>
                act(async () => {
                  const next = mailbox.status === "active" ? "disabled" : "active";
                  await setAccountMailboxStatus(mailbox.id, next, lang);
                  return next === "active" ? t.mailboxEnabled(mailbox.email) : t.mailboxDisabled(mailbox.email);
                })
              }
              onDelete={(mailbox, confirm) =>
                act(async () => {
                  await deleteAccountMailbox(mailbox.id, confirm, lang);
                  return t.mailboxDeleted(mailbox.email);
                })
              }
            />
          ))}
          <MailServers lang={lang} servers={data.servers} />
        </div>
      )}
    </ShopPanel>
  );
}

function MailboxGroup({
  lang,
  group,
  open,
  busy,
  created,
  onOpen,
  onCreate,
  onPassword,
  onStatus,
  onDelete,
}: {
  lang: Lang;
  group: AccountMailboxGroup;
  open: Open;
  busy: boolean;
  created: Created | null;
  onOpen: (next: Open) => void;
  onCreate: (input: { domain: string; username: string; password: string }) => Promise<boolean>;
  onPassword: (mailbox: AccountMailbox, password: string) => Promise<boolean>;
  onStatus: (mailbox: AccountMailbox) => Promise<boolean>;
  onDelete: (mailbox: AccountMailbox, confirm: string) => Promise<boolean>;
}) {
  const t = shopCopy[lang];
  const canCreate = !group.locked && group.usesLeft > 0 && group.domains.length > 0;
  const creating = open?.kind === "create" && open.orderId === group.orderId;
  return (
    <div className={shopAccountItemClass}>
      <div className={shopHeadingRowClass}>
        <h3 className="text-md/[1.2]">{group.productName}</h3>
        <ShopStatus active={!group.locked}>
          {group.locked ? t.mailboxesLocked : t.mailboxesUsed(group.mailboxes.length, group.mailboxLimit)}
        </ShopStatus>
      </div>
      <ShopMeta>
        <ShopMetaRow label={t.codeTitle}>
          <ShopOrderCode>{group.code}</ShopOrderCode> · {t.statuses[group.codeStatus]}
        </ShopMetaRow>
        <ShopMetaRow label={t.mailboxesLeft}>{t.mailboxesLeftValue(group.usesLeft)}</ShopMetaRow>
      </ShopMeta>
      {group.locked && <p className={shopTextClass}>{t.mailboxesLockedHint}</p>}
      {group.mailboxes.length > 0 && (
        <ul className="mt-5 grid gap-3">
          {group.mailboxes.map((mailbox) => (
            <MailboxRow
              key={mailbox.id}
              lang={lang}
              mailbox={mailbox}
              locked={group.locked}
              open={open && "mailboxId" in open && open.mailboxId === mailbox.id ? open.kind : null}
              busy={busy}
              onOpen={(kind) => onOpen(kind ? { mailboxId: mailbox.id, kind } : null)}
              onPassword={(password) => onPassword(mailbox, password)}
              onStatus={() => onStatus(mailbox)}
              onDelete={(confirm) => onDelete(mailbox, confirm)}
            />
          ))}
        </ul>
      )}
      {created && (
        <div className="mt-5 rounded-md border border-border p-4" role="status">
          <p className="text-sm/[1.7]">{t.mailboxCreated(created.email)}</p>
          <InputGroup size="lg" className="mt-3 max-w-[420px]">
            <InputGroupInput readOnly value={created.password} aria-label={t.mailboxCreatedPassword} />
            <CopyButton text={created.password} label={t.mailboxCopy} copiedLabel={t.mailboxCopied} />
          </InputGroup>
          <p className="mt-2 text-xs/[1.6] text-muted-foreground">{t.mailboxCreatedOnce}</p>
        </div>
      )}
      {canCreate &&
        (creating ? (
          <CreateMailboxForm
            lang={lang}
            domains={group.domains}
            busy={busy}
            onCancel={() => onOpen(null)}
            onSubmit={onCreate}
          />
        ) : (
          <ShopActions>
            <ShopButton
              type="button"
              disabled={busy}
              onClick={() => onOpen({ orderId: group.orderId, kind: "create" })}
            >
              {t.mailboxCreate}
            </ShopButton>
          </ShopActions>
        ))}
    </div>
  );
}

function usage(t: (typeof shopCopy)[Lang], mailbox: AccountMailbox): string {
  const mb = (value: number) => (value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`);
  if (mailbox.usageMb === null) return t.mailboxUsageUnknown;
  if (mailbox.quotaMb === null || mailbox.quotaMb === 0) return mb(mailbox.usageMb);
  return `${mb(mailbox.usageMb)} / ${mb(mailbox.quotaMb)}`;
}

function MailboxRow({
  lang,
  mailbox,
  locked,
  open,
  busy,
  onOpen,
  onPassword,
  onStatus,
  onDelete,
}: {
  lang: Lang;
  mailbox: AccountMailbox;
  locked: boolean;
  open: "password" | "delete" | null;
  busy: boolean;
  onOpen: (kind: "password" | "delete" | null) => void;
  onPassword: (password: string) => Promise<boolean>;
  onStatus: () => Promise<boolean>;
  onDelete: (confirm: string) => Promise<boolean>;
}) {
  const t = shopCopy[lang];
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [problem, setProblem] = useState("");
  const id = `mailbox-${mailbox.id}`;

  function close() {
    setPassword("");
    setConfirm("");
    setProblem("");
    setShow(false);
    onOpen(null);
  }

  return (
    <li className="rounded-md border border-border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm/[1.5] wrap-anywhere">{mailbox.email}</p>
          <p className="mt-0.5 text-xs/[1.6] text-muted-foreground">
            {mailbox.status === "active" ? t.mailboxActive : t.mailboxInactive} · {usage(t, mailbox)}
          </p>
        </div>
        {!locked && open === null && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.mailboxActions(mailbox.email)}>
            <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => onOpen("password")}>
              {t.mailboxResetPassword}
            </Button>
            <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => void onStatus()}>
              {mailbox.status === "active" ? t.mailboxDisable : t.mailboxEnable}
            </Button>
            <Button size="sm" variant="outline" type="button" disabled={busy} onClick={() => onOpen("delete")}>
              {t.mailboxDelete}
            </Button>
          </div>
        )}
      </div>
      {open === "password" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const issue = passwordProblem(password);
            if (issue) return setProblem(t.mailboxPasswordRule);
            void onPassword(password).then((ok) => ok && close());
          }}
        >
          <ShopField htmlFor={`${id}-password`} label={t.mailboxNewPassword} hint={problem || t.mailboxPasswordRule}>
            <InputGroup size="lg" className="max-w-[420px]">
              <InputGroupInput
                id={`${id}-password`}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                maxLength={128}
                aria-invalid={problem ? true : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <InputGroupButton className={inputActionClass} aria-pressed={show} onClick={() => setShow(!show)}>
                {show ? t.mailboxHide : t.mailboxShow}
              </InputGroupButton>
              <InputGroupButton
                className={inputActionClass}
                onClick={() => {
                  setPassword(generatePassword());
                  setShow(true);
                }}
              >
                {t.mailboxGenerate}
              </InputGroupButton>
            </InputGroup>
          </ShopField>
          <p className="text-xs/[1.6] text-muted-foreground">{t.mailboxPasswordEffect}</p>
          <ShopActions>
            <ShopButton type="submit" disabled={busy}>
              {busy ? t.passwordSaving : t.mailboxSavePassword}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy} onClick={close}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}
      {open === "delete" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onDelete(confirm).then((ok) => ok && close());
          }}
        >
          <p className="mt-4 text-sm/[1.7] text-destructive">{t.mailboxDeleteWarning(mailbox.email)}</p>
          <ShopField htmlFor={`${id}-confirm`} label={t.mailboxDeleteConfirm(mailbox.email)}>
            <Input
              className={cn(shopInputClass, "max-w-[420px] font-mono")}
              id={`${id}-confirm`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={busy}
            />
          </ShopField>
          <ShopActions>
            <ShopButton
              type="submit"
              variant="destructive"
              disabled={busy || confirm.trim().toLowerCase() !== mailbox.email}
            >
              {busy ? t.mailboxDeleting : t.mailboxDeleteButton}
            </ShopButton>
            <ShopButton variant="outline" type="button" disabled={busy} onClick={close}>
              {t.passwordCancel}
            </ShopButton>
          </ShopActions>
        </form>
      )}
    </li>
  );
}

function CreateMailboxForm({
  lang,
  domains,
  busy,
  onCancel,
  onSubmit,
}: {
  lang: Lang;
  domains: string[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { domain: string; username: string; password: string }) => Promise<boolean>;
}) {
  const t = shopCopy[lang];
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [show, setShow] = useState(true);
  const [problem, setProblem] = useState<{ field: "username" | "password"; message: string } | null>(null);

  return (
    <form
      className="mt-5"
      onSubmit={(event) => {
        event.preventDefault();
        const name = normalizeUsername(username);
        if (usernameProblem(name)) return setProblem({ field: "username", message: t.mailboxUsernameRule });
        if (passwordProblem(password)) return setProblem({ field: "password", message: t.mailboxPasswordRule });
        setProblem(null);
        void onSubmit({ domain, username: name, password });
      }}
    >
      {domains.length > 1 && (
        <ShopField htmlFor="mailbox-create-domain" label={t.mailboxDomain}>
          <NativeSelect
            className={cn(shopInputClass, "max-w-[420px] cursor-pointer")}
            id="mailbox-create-domain"
            value={domain}
            onChange={(event) => setDomain(event.currentTarget.value)}
            disabled={busy}
          >
            {domains.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </ShopField>
      )}
      <ShopField
        htmlFor="mailbox-create-username"
        label={t.mailboxUsername}
        hint={problem?.field === "username" ? problem.message : t.mailboxUsernameRule}
      >
        <InputGroup size="lg" className="max-w-[420px]">
          <InputGroupInput
            id="mailbox-create-username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            maxLength={64}
            aria-invalid={problem?.field === "username" ? true : undefined}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={busy}
          />
          <InputGroupSuffix>@{domain}</InputGroupSuffix>
        </InputGroup>
      </ShopField>
      <ShopField
        htmlFor="mailbox-create-password"
        label={t.mailboxPassword}
        hint={problem?.field === "password" ? problem.message : t.mailboxPasswordRule}
      >
        <InputGroup size="lg" className="max-w-[420px]">
          <InputGroupInput
            id="mailbox-create-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            maxLength={128}
            aria-invalid={problem?.field === "password" ? true : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
          />
          <InputGroupButton className={inputActionClass} aria-pressed={show} onClick={() => setShow(!show)}>
            {show ? t.mailboxHide : t.mailboxShow}
          </InputGroupButton>
          <InputGroupButton className={inputActionClass} onClick={() => setPassword(generatePassword())}>
            {t.mailboxGenerate}
          </InputGroupButton>
        </InputGroup>
      </ShopField>
      <ShopActions>
        <ShopButton type="submit" disabled={busy}>
          {busy ? t.mailboxCreating : t.mailboxCreateSubmit}
        </ShopButton>
        <ShopButton variant="outline" type="button" disabled={busy} onClick={onCancel}>
          {t.passwordCancel}
        </ShopButton>
      </ShopActions>
    </form>
  );
}

/** Incoming and outgoing servers to enter in a mail client: listed per domain, collapsed at the end. */
function MailServers({ lang, servers }: { lang: Lang; servers: AccountMailboxes["servers"] }) {
  const t = shopCopy[lang];
  const entries = Object.entries(servers).filter(([, value]) => value.imap || value.smtp);
  if (entries.length === 0) return null;
  const security = (value: string) => (value === "tls" ? "SSL/TLS" : value === "starttls" ? "STARTTLS" : value);
  return (
    <details className="mt-6 border-t border-border pt-5">
      <summary className="cursor-pointer text-sm/[1.7]">{t.mailServersTitle}</summary>
      {entries.map(([domain, { imap, smtp }]) => (
        <ShopMeta key={domain}>
          <ShopMetaRow label={domain}>
            {imap && (
              <span className="block">{t.mailServerLine("IMAP", imap.host, imap.port, security(imap.security))}</span>
            )}
            {smtp && (
              <span className="block">{t.mailServerLine("SMTP", smtp.host, smtp.port, security(smtp.security))}</span>
            )}
          </ShopMetaRow>
        </ShopMeta>
      ))}
      <p className={shopTextClass}>{t.mailServersHint}</p>
    </details>
  );
}
