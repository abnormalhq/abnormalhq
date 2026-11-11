"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import type { Lang } from "@/storefront/i18n";
import {
  addAccountDomain,
  checkAccountDomain,
  domainPollDelay,
  domainSettled,
  getAccountDomains,
  normalizeDomainInput,
  recordHost,
  refreshAccountDomain,
  removeAccountDomain,
  verifyAccountDomain,
  type AccountDomain,
  type AccountDomains,
  type DomainCheck,
  type DomainRecord,
} from "@/storefront/lib/domains";
import { formatDateTime } from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { CopyButton } from "./onboard/CopyButton";
import {
  ShopActions,
  ShopAlert,
  ShopButton,
  ShopField,
  ShopPanel,
  ShopStatus,
  shopAccountItemClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopTextClass,
} from "./ShopParts";

/**
 * "Use my own domain" on the account page ("Buyer domains" in docs/storefront-api.md): the buyer reserves a domain, publishes
 * the ownership TXT record, verifies, publishes the mail records and waits for the provider's review. Every rule is mail's: the
 * page shows its answers, and its refusals in its own words (it gives one answer for a domain that is taken, whoever has it).
 * The panel is not rendered at all while the backend has no buyer domains (the list answers 404) or the account has neither a
 * plan that includes them nor a domain.
 */
export function ShopDomains({
  lang,
  onLive,
}: {
  lang: Lang;
  /** A domain went live: "My mailboxes" offers it now, so its list is read again. */
  onLive: () => void;
}) {
  const t = shopCopy[lang];
  // undefined: still loading; null: not offered (signed out, or a backend without buyer domains).
  const [data, setData] = useState<AccountDomains | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAccountDomains(controller.signal, lang)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoadError("");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(shopError(cause, lang));
      });
    return () => controller.abort();
  }, [lang, reload]);

  if (data === null) return null;
  // Nothing to say to an account whose plans include no own domain and that has none.
  if (data && data.limit === 0 && data.domains.length === 0) return null;
  // Still loading: nothing is shown until it is known that the feature is there, so the panel never flashes and goes.
  if (data === undefined && !loadError) return null;

  const update = (next: AccountDomain) =>
    setData((current) =>
      current ? { ...current, domains: current.domains.map((item) => (item.id === next.id ? next : item)) } : current,
    );

  async function add() {
    if (adding) return;
    const domain = normalizeDomainInput(name);
    setError("");
    setNotice("");
    if (!domain) return input.current?.focus();
    setAdding(true);
    try {
      const added = await addAccountDomain(domain, lang);
      setData((current) => (current ? { ...current, domains: [...current.domains, added] } : current));
      setName("");
      setNotice(t.domainAdded(added.name));
    } catch (cause) {
      // The field reads out mail's reason: not a domain name, a public suffix, the provider's own, already in use, or the limit.
      setError(shopError(cause, lang));
      input.current?.focus();
    } finally {
      setAdding(false);
    }
  }

  return (
    <ShopPanel>
      <div className={shopHeadingRowClass}>
        <h2 className={shopHeadingClass}>{t.domainsTitle}</h2>
        {data && data.limit > 0 && <ShopStatus>{t.domainsCount(data.domains.length, data.limit)}</ShopStatus>}
      </div>
      <p className={shopTextClass}>{data && data.limit === 0 ? t.domainsNotIncluded : t.domainsHint}</p>
      {loadError && (
        <>
          <ShopAlert className="mt-4">{loadError}</ShopAlert>
          <ShopButton
            type="button"
            variant="outline"
            onClick={() => {
              setLoadError("");
              setReload((value) => value + 1);
            }}
          >
            {t.retry}
          </ShopButton>
        </>
      )}
      {notice && (
        <p className="mt-4 text-sm/[1.7]" role="status">
          {notice}
        </p>
      )}
      {data && data.domains.length > 0 && (
        <div className="mt-6">
          {data.domains.map((domain) => (
            <DomainCard
              key={domain.id}
              lang={lang}
              domain={domain}
              onUpdate={update}
              onLive={onLive}
              onRemoved={() => {
                setData((current) =>
                  current ? { ...current, domains: current.domains.filter((item) => item.id !== domain.id) } : current,
                );
                setNotice(t.domainRemoved(domain.name));
              }}
            />
          ))}
        </div>
      )}
      {data && data.domains.length < data.limit && (
        <form
          className={cn(data.domains.length > 0 && "mt-6 border-t border-border pt-1")}
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <ShopField
            htmlFor="shop-domain-add"
            label={t.domainAddLabel}
            hint={error || t.domainAddHint}
            hintId="shop-domain-add-hint"
            invalid={Boolean(error)}
          >
            <div className="flex flex-wrap gap-2">
              <Input
                ref={input}
                className={cn(shopInputClass, "max-w-[320px] min-w-0 flex-1")}
                id="shop-domain-add"
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={255}
                placeholder="example.com"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                disabled={adding}
                aria-describedby="shop-domain-add-hint"
                aria-invalid={error ? true : undefined}
              />
              <ShopButton type="submit" disabled={adding || !name.trim()}>
                {adding ? t.domainAdding : t.domainAddButton}
              </ShopButton>
            </div>
          </ShopField>
        </form>
      )}
    </ShopPanel>
  );
}

/** A value to copy into a DNS panel: read-only, selectable, with a copy button named after what it copies. */
function CopyField({
  id,
  label,
  value,
  hint,
  lang,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  lang: Lang;
}) {
  const t = shopCopy[lang];
  return (
    <div className="grid gap-1.5">
      <label className="text-xs/body text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <InputGroup size="lg">
        <InputGroupInput
          id={id}
          readOnly
          className="font-mono text-sm"
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(event) => event.currentTarget.select()}
        />
        <CopyButton text={value} label={t.domainCopy} copiedLabel={t.domainCopied} />
      </InputGroup>
      {hint && (
        <p className="text-xs/[1.6] text-muted-foreground" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function DomainCard({
  lang,
  domain,
  onUpdate,
  onRemoved,
  onLive,
}: {
  lang: Lang;
  domain: AccountDomain;
  onUpdate: (domain: AccountDomain) => void;
  onRemoved: () => void;
  onLive: () => void;
}) {
  const t = shopCopy[lang];
  const id = useId();
  // The records and their status as last checked; null until the first check (a reservation has none to check).
  const [check, setCheck] = useState<Pick<DomainCheck, "records" | "ready" | "checkedAt"> | null>(null);
  const [busy, setBusy] = useState<"verify" | "check" | "refresh" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Automatic checks made since the buyer last acted, and whether they go on (a failed or rate-limited check stops them).
  const [done, setDone] = useState(0);
  const [auto, setAuto] = useState(true);
  const [shownAt] = useState(() => Date.now());
  const status = useRef(domain.status);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  function apply(result: DomainCheck) {
    setCheck({ records: result.records, ready: result.ready, checkedAt: result.checkedAt });
    onUpdate(result.domain);
    if (result.domain.status === "live" && status.current !== "live") onLive();
    status.current = result.domain.status;
  }

  async function runCheck(automatic: boolean) {
    if (busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy("check");
    setError("");
    try {
      const result = await checkAccountDomain(domain.id, controller.signal, lang);
      if (controller.signal.aborted) return;
      apply(result);
      if (automatic) setDone((value) => value + 1);
      else {
        // The buyer asked: start the automatic rounds over.
        setDone(0);
        setAuto(true);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      // A refusal (mail's rate limit says how long to wait) ends the automatic checks; "Check again" starts them over.
      setError(shopError(cause, lang));
      setAuto(false);
    } finally {
      if (mounted.current && request.current === controller) setBusy(null);
    }
  }
  // The timer below always calls the latest runCheck, without restarting when unrelated state changes.
  const latestCheck = useRef(runCheck);
  useEffect(() => {
    latestCheck.current = runCheck;
  });

  const settled = domainSettled(domain, check?.ready ?? false);
  // A domain past its reservation is checked once as the page opens (its records are not in the list), then in backed-off rounds.
  const first = check === null && domain.status !== "pending";
  const delay = !auto || busy !== null ? null : first ? 0 : settled ? null : domainPollDelay(done);

  useEffect(() => {
    if (delay === null) return;
    let timer = 0;
    // Politely: never while the tab is hidden. Coming back to the tab starts the wait again.
    const arm = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(() => void latestCheck.current(!first), delay * 1000);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [delay, first, done]);

  async function act(kind: "verify" | "refresh" | "remove", work: () => Promise<string | void>) {
    if (busy) return;
    request.current?.abort();
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      const message = await work();
      if (mounted.current && message) setNotice(message);
    } catch (cause) {
      // mail's reason: the TXT record is not visible yet, wrong or expired; the wait of a rate limit; the mail server not answering.
      if (mounted.current) setError(shopError(cause, lang));
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  const ownership = domain.ownership;
  const expired = ownership ? Date.parse(ownership.expiresAt) <= shownAt : false;
  const note =
    domain.status === "live" && check && !check.ready
      ? t.domainStatusNotes.liveNotReady
      : t.domainStatusNotes[domain.status];
  const polling = delay !== null && !first;

  return (
    <section className={shopAccountItemClass} aria-labelledby={`${id}-name`}>
      <div className={shopHeadingRowClass}>
        <h3 className="font-mono text-md/[1.3] wrap-anywhere" id={`${id}-name`}>
          {domain.name}
        </h3>
        <ShopStatus active={domain.status === "live"}>{t.domainStatuses[domain.status]}</ShopStatus>
      </div>
      <p className={shopTextClass}>{note}</p>
      {domain.phase !== "active" && <ShopAlert className="mt-4 mb-0">{t.domainPhaseNotes[domain.phase]}</ShopAlert>}
      {error && <ShopAlert className="mt-4 mb-0">{error}</ShopAlert>}
      {notice && (
        <p className="mt-4 text-sm/[1.7]" role="status">
          {notice}
        </p>
      )}

      {ownership && (
        <div className="mt-5 rounded-md border border-border p-4">
          <h4 className="text-sm/[1.5] font-semibold">{t.domainOwnershipTitle}</h4>
          <div className="mt-3 grid gap-4">
            <p className="text-sm/body">
              <span className="text-xs/body text-muted-foreground">{t.domainRecordType}</span>
              <span className="ml-3 font-mono">{ownership.type}</span>
            </p>
            <CopyField id={`${id}-own-name`} lang={lang} label={t.domainRecordName} value={ownership.name} />
            <CopyField
              id={`${id}-own-host`}
              lang={lang}
              label={t.domainRecordHost}
              value={recordHost(ownership.name, domain.name)}
              hint={t.domainRecordHostHint}
            />
            <CopyField id={`${id}-own-value`} lang={lang} label={t.domainRecordValue} value={ownership.value} />
          </div>
          <p className={cn("mt-3 text-xs/[1.6]", expired ? "text-destructive" : "text-muted-foreground")}>
            {expired ? t.domainOwnershipExpired : t.domainOwnershipExpires(formatDateTime(ownership.expiresAt, lang))}
          </p>
          <ShopActions>
            <ShopButton
              type="button"
              variant={expired ? "outline" : "default"}
              disabled={busy !== null}
              onClick={() =>
                void act("verify", async () => {
                  apply(await verifyAccountDomain(domain.id, lang));
                  setDone(0);
                  setAuto(true);
                  return t.domainVerified;
                })
              }
            >
              {busy === "verify" ? t.domainVerifying : t.domainVerify}
            </ShopButton>
            <ShopButton
              type="button"
              variant={expired ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() =>
                void act("refresh", async () => {
                  onUpdate(await refreshAccountDomain(domain.id, lang));
                  return t.domainRefreshed;
                })
              }
            >
              {busy === "refresh" ? t.domainRefreshing : t.domainRefresh}
            </ShopButton>
            <ShopButton
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void act("remove", async () => {
                  await removeAccountDomain(domain.id, lang);
                  onRemoved();
                })
              }
            >
              {busy === "remove" ? t.domainRemoving : t.domainRemove}
            </ShopButton>
          </ShopActions>
          <p className="mt-3 text-xs/[1.6] text-muted-foreground">{t.domainRemoveNote}</p>
        </div>
      )}

      {domain.status !== "pending" && (
        <div className="mt-5">
          <h4 className="text-sm/[1.5] font-semibold">{t.domainRecordsTitle}</h4>
          <p className="mt-1.5 text-xs/[1.7] text-muted-foreground">{t.domainRecordsHint}</p>
          {!check || check.records.length === 0 ? (
            <p className={shopTextClass} role="status">
              {busy === "check" ? t.domainChecking : t.domainRecordsEmpty}
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-3">
                {check.records.map((item, index) => (
                  <RecordRow
                    key={`${item.type}:${item.name}:${item.value}`}
                    id={`${id}-record-${index}`}
                    lang={lang}
                    record={item}
                    domain={domain.name}
                  />
                ))}
              </ul>
              {/* Read out when a check changes the outcome. */}
              <p className="mt-4 text-sm/[1.7]" role="status">
                {check.ready ? t.domainReady : t.domainNotReady}{" "}
                <span className="text-muted-foreground">
                  {t.domainCheckedAt(formatDateTime(check.checkedAt, lang))}
                </span>
              </p>
            </>
          )}
          {!(domain.status === "live" && check?.ready) && (
            <>
              <ShopActions>
                <ShopButton
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void runCheck(false)}
                >
                  {busy === "check" ? t.domainChecking : t.domainCheck}
                </ShopButton>
              </ShopActions>
              {domain.status !== "suspended" && (
                <p className="mt-3 text-xs/[1.6] text-muted-foreground">
                  {polling || busy === "check" || first ? t.domainPolling : t.domainPollingStopped}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RecordRow({ id, lang, record, domain }: { id: string; lang: Lang; record: DomainRecord; domain: string }) {
  const t = shopCopy[lang];
  const purpose = t.domainPurposes[record.purpose] ?? record.type;
  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm/[1.5] font-semibold">
          {purpose}
          <span className="ml-2 text-xs/body font-normal text-muted-foreground">
            {record.type} · {record.required ? t.domainRecordRequired : t.domainRecordOptional}
          </span>
        </p>
        <ShopStatus active={record.status === "matched"}>
          <span className="sr-only">{t.domainRecordStatus}: </span>
          {t.domainRecordStatuses[record.status]}
        </ShopStatus>
      </div>
      <div className="mt-3 grid gap-3">
        <CopyField
          id={`${id}-name`}
          lang={lang}
          label={`${t.domainRecordName} · ${t.domainRecordHost}: ${recordHost(record.name, domain)}`}
          value={record.name}
        />
        <CopyField id={`${id}-value`} lang={lang} label={t.domainRecordValue} value={record.value} />
        {record.priority !== undefined && (
          <p className="text-sm/body">
            <span className="text-xs/body text-muted-foreground">{t.domainRecordPriority}</span>
            <span className="ml-3 font-mono">{record.priority}</span>
          </p>
        )}
      </div>
      {record.status === "conflict" && record.observed.length > 0 && (
        <p className="mt-3 text-xs/[1.6] text-destructive">
          {t.domainRecordObserved} <span className="font-mono wrap-anywhere">{record.observed.join(", ")}</span>
        </p>
      )}
      {record.status === "error" && (
        <p className="mt-3 text-xs/[1.6] text-muted-foreground">{t.domainRecordErrorNote}</p>
      )}
    </li>
  );
}
