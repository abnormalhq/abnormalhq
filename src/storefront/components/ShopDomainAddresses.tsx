"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupSuffix } from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import type { Lang } from "@/storefront/i18n";
import {
  addDomainAlias,
  addDomainGroup,
  getDomainAddresses,
  normalizeLocalPart,
  removeDomainAlias,
  removeDomainGroup,
  setDomainCatchAll,
  updateDomainGroup,
  type DomainAddresses,
  type DomainGroup,
} from "@/storefront/lib/domain-addresses";
import { describeShopError } from "@/storefront/lib/shop-error";
import { useShopCopy } from "./copy/hooks";
import { cn } from "@/lib/utils";
import { ShopActions, ShopAlert, ShopButton, ShopField, shopChipClass, shopInputClass } from "./ShopParts";

type Busy = "alias" | "group" | "catch-all" | `remove:${string}` | `save:${string}` | null;

/**
 * The addresses on a live buyer domain ("Addresses on a buyer domain" in docs/storefront-api.md): aliases, group addresses and
 * where mail to unknown addresses goes. mail decides everything (the names it accepts, whose mailboxes count, the limits) and
 * refuses in its own words; the page only offers the buyer's own mailboxes to choose from. Nothing is rendered while mail has no
 * address management (the read answers a 404 without a code).
 */
export function ShopDomainAddresses({
  lang,
  domainId,
  domain,
  refresh = 0,
}: {
  lang: Lang;
  domainId: string;
  domain: string;
  /** Changes when the account's mailboxes changed (one created or deleted): the destinations are read again. */
  refresh?: number;
}) {
  const t = useShopCopy();
  const id = useId();
  // undefined: loading; null: not offered by this mail.
  const [data, setData] = useState<DomainAddresses | null | undefined>(undefined);
  const [reload, setReload] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ where: string; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  // The row whose "Remove" was pressed once and now asks to be confirmed.
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getDomainAddresses(domainId, controller.signal, lang)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setLoadError("");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(describeShopError(cause, lang, t));
      });
    return () => controller.abort();
  }, [domainId, lang, reload, refresh, t]);

  if (data === null) return null;

  async function act(kind: Exclude<Busy, null>, where: string, work: () => Promise<string | void>): Promise<boolean> {
    if (busy) return false;
    setBusy(kind);
    setError(null);
    setNotice("");
    try {
      const message = await work();
      if (message) setNotice(message);
      return true;
    } catch (cause) {
      setError({ where, message: describeShopError(cause, lang, t) });
      return false;
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  const errorFor = (where: string) =>
    error?.where === where ? <ShopAlert className="mt-3 mb-0">{error.message}</ShopAlert> : null;

  return (
    <div className="mt-5 rounded-control border border-border p-4" aria-labelledby={`${id}-title`} role="group">
      <h4 className="text-sm/normal font-semibold" id={`${id}-title`}>
        {t.addressesTitle}
      </h4>
      <p className="mt-1.5 text-xs/[1.7] text-muted-foreground">{t.addressesHint}</p>
      {data === undefined && !loadError && (
        <p className="mt-3 text-sm/[1.7] text-muted-foreground" role="status">
          {t.addressesLoading}
        </p>
      )}
      {loadError && (
        <>
          <ShopAlert className="mt-3 mb-0">{loadError}</ShopAlert>
          <ShopActions>
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
          </ShopActions>
        </>
      )}
      {data && (
        <>
          {!data.editable && <ShopAlert className="mt-3 mb-0">{t.addressesLocked}</ShopAlert>}
          {data.editable && data.mailboxes.length === 0 && (
            <p className="mt-3 text-sm/[1.7] text-muted-foreground">{t.addressesNoMailboxes}</p>
          )}
          {notice && (
            <p className="mt-3 text-sm/[1.7]" role="status">
              {notice}
            </p>
          )}

          <AddressSection
            title={t.aliasesTitle}
            hint={t.aliasesHint}
            count={data.aliases.length}
            limit={data.limits.aliases}
          >
            {data.aliases.length === 0 ? (
              <p className="mt-2 text-sm/[1.7] text-muted-foreground">{t.aliasesEmpty}</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {data.aliases.map((alias) => (
                  <AddressRow
                    key={alias.id}
                    address={alias.address}
                    detail={`→ ${alias.target}`}
                    editable={data.editable}
                    busy={busy}
                    removing={busy === `remove:${alias.id}`}
                    confirming={confirming === alias.id}
                    onRemove={() => {
                      if (confirming !== alias.id) return setConfirming(alias.id);
                      void act(`remove:${alias.id}`, "aliases", async () => {
                        await removeDomainAlias(domainId, alias.id, lang);
                        setData((current) =>
                          current
                            ? { ...current, aliases: current.aliases.filter((item) => item.id !== alias.id) }
                            : current,
                        );
                        return t.addressRemoved(alias.address);
                      });
                    }}
                  />
                ))}
              </ul>
            )}
            {errorFor("aliases")}
            {data.editable && data.mailboxes.length > 0 && (
              <AliasForm
                id={`${id}-alias`}
                domain={domain}
                mailboxes={data.mailboxes}
                full={data.aliases.length >= data.limits.aliases}
                busy={busy}
                onSubmit={(username, target) =>
                  act("alias", "aliases", async () => {
                    const alias = await addDomainAlias(domainId, username, target, lang);
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            aliases: [...current.aliases, alias].sort((a, b) => a.address.localeCompare(b.address)),
                          }
                        : current,
                    );
                    return t.addressAdded(alias.address);
                  })
                }
              />
            )}
          </AddressSection>

          <AddressSection
            title={t.groupsTitle}
            hint={t.groupsHint}
            count={data.groups.length}
            limit={data.limits.groups}
          >
            {data.groups.length === 0 ? (
              <p className="mt-2 text-sm/[1.7] text-muted-foreground">{t.groupsEmpty}</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {data.groups.map((group) => (
                  <GroupRow
                    key={group.id}
                    group={group}
                    candidates={data.members}
                    maxMembers={data.limits.members}
                    editable={data.editable}
                    busy={busy}
                    confirming={confirming === group.id}
                    onRemove={() => {
                      if (confirming !== group.id) return setConfirming(group.id);
                      void act(`remove:${group.id}`, "groups", async () => {
                        await removeDomainGroup(domainId, group.id, lang);
                        setData((current) =>
                          current
                            ? { ...current, groups: current.groups.filter((item) => item.id !== group.id) }
                            : current,
                        );
                        return t.addressRemoved(group.address);
                      });
                    }}
                    onSave={(members) =>
                      act(`save:${group.id}`, "groups", async () => {
                        const saved = await updateDomainGroup(domainId, group, members, lang);
                        setData((current) =>
                          current
                            ? {
                                ...current,
                                groups: current.groups.map((item) => (item.id === saved.id ? saved : item)),
                              }
                            : current,
                        );
                        return t.groupSaved(saved.address);
                      })
                    }
                  />
                ))}
              </ul>
            )}
            {errorFor("groups")}
            {data.editable && data.members.length > 0 && (
              <GroupForm
                id={`${id}-group`}
                domain={domain}
                candidates={data.members}
                maxMembers={data.limits.members}
                full={data.groups.length >= data.limits.groups}
                busy={busy}
                onSubmit={(username, members, description) =>
                  act("group", "groups", async () => {
                    const group = await addDomainGroup(domainId, username, members, description, lang);
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            groups: [...current.groups, group].sort((a, b) => a.address.localeCompare(b.address)),
                          }
                        : current,
                    );
                    return t.addressAdded(group.address);
                  })
                }
              />
            )}
          </AddressSection>

          <AddressSection title={t.catchAllTitle} hint={t.catchAllHint}>
            <CatchAllForm
              id={`${id}-catch-all`}
              current={data.catchAll}
              mailboxes={data.mailboxes}
              editable={data.editable}
              busy={busy}
              onSubmit={(destination) =>
                act("catch-all", "catch-all", async () => {
                  const catchAll = await setDomainCatchAll(domainId, destination, lang);
                  setData((current) => (current ? { ...current, catchAll } : current));
                  return t.catchAllSaved;
                })
              }
            />
            {errorFor("catch-all")}
          </AddressSection>
        </>
      )}
    </div>
  );
}

function AddressSection({
  title,
  hint,
  count,
  limit,
  children,
}: {
  title: string;
  hint: string;
  count?: number;
  limit?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm/normal font-semibold">{title}</h5>
        {count !== undefined && limit !== undefined && (
          <Badge className={shopChipClass}>
            {count} / {limit}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs/[1.7] text-muted-foreground">{hint}</p>
      {children}
    </section>
  );
}

function AddressRow({
  address,
  detail,
  editable,
  busy,
  removing,
  confirming,
  onRemove,
  children,
}: {
  address: string;
  detail?: string;
  editable: boolean;
  busy: Busy;
  removing: boolean;
  confirming: boolean;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const t = useShopCopy();
  return (
    <li className="rounded-control border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 text-sm/normal">
          <span className="font-mono wrap-anywhere">{address}</span>
          {detail && <span className="ml-2 font-mono text-xs/body wrap-anywhere text-muted-foreground">{detail}</span>}
        </p>
        {editable && (
          <ShopButton
            type="button"
            size="sm"
            variant={confirming ? "destructive" : "outline"}
            disabled={busy !== null}
            onClick={onRemove}
          >
            {removing ? t.addressRemoving : confirming ? t.addressRemoveConfirm : t.addressRemove}
          </ShopButton>
        )}
      </div>
      {children}
    </li>
  );
}

/** The name before "@", with the domain shown after it. */
function LocalPartInput({
  id,
  domain,
  value,
  onChange,
  disabled,
}: {
  id: string;
  domain: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <InputGroup size="lg" className="max-w-105">
      <InputGroupInput
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // A whole pasted address is accepted and cut down to the name on submit (normalizeLocalPart); mail checks the name's length.
        maxLength={320}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <InputGroupSuffix className="font-mono">@{domain}</InputGroupSuffix>
    </InputGroup>
  );
}

function AliasForm({
  id,
  domain,
  mailboxes,
  full,
  busy,
  onSubmit,
}: {
  id: string;
  domain: string;
  mailboxes: string[];
  full: boolean;
  busy: Busy;
  onSubmit: (username: string, target: string) => Promise<boolean>;
}) {
  const t = useShopCopy();
  const [name, setName] = useState("");
  const [target, setTarget] = useState(mailboxes[0] ?? "");
  // A destination that is no longer offered (the mailbox was deleted meanwhile) is never swapped for another one: the buyer picks again.
  const chosen = mailboxes.includes(target) ? target : "";
  if (full) return <p className="mt-3 text-xs/[1.6] text-muted-foreground">{t.addressLimitReached}</p>;
  return (
    <form
      className="mt-1"
      onSubmit={(event) => {
        event.preventDefault();
        const username = normalizeLocalPart(name, domain);
        if (!username || !chosen) return;
        void onSubmit(username, chosen).then((ok) => ok && setName(""));
      }}
    >
      <ShopField htmlFor={`${id}-name`} label={t.addressName}>
        <LocalPartInput id={`${id}-name`} domain={domain} value={name} onChange={setName} disabled={busy !== null} />
      </ShopField>
      <ShopField htmlFor={`${id}-target`} label={t.aliasTarget}>
        <NativeSelect
          className={cn(shopInputClass, "max-w-105 cursor-pointer")}
          id={`${id}-target`}
          value={chosen}
          onChange={(event) => setTarget(event.currentTarget.value)}
          disabled={busy !== null}
        >
          {chosen === "" && (
            <option value="" disabled>
              {t.aliasTargetPlaceholder}
            </option>
          )}
          {mailboxes.map((mailbox) => (
            <option key={mailbox} value={mailbox}>
              {mailbox}
            </option>
          ))}
        </NativeSelect>
      </ShopField>
      <ShopButton type="submit" disabled={busy !== null || !name.trim() || !chosen}>
        {busy === "alias" ? t.aliasAdding : t.aliasAdd}
      </ShopButton>
    </form>
  );
}

/** A checkbox per mailbox the group can include. */
function MemberPicker({
  legend,
  candidates,
  chosen,
  max,
  disabled,
  onChange,
}: {
  legend: string;
  candidates: string[];
  chosen: string[];
  max: number;
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-sm/body">{legend}</legend>
      <ul className="mt-2 grid gap-1">
        {candidates.map((mailbox) => {
          const checked = chosen.includes(mailbox);
          return (
            <li key={mailbox}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm/normal">
                <Checkbox
                  checked={checked}
                  disabled={disabled || (!checked && chosen.length >= max)}
                  onCheckedChange={(next) =>
                    onChange(next === true ? [...chosen, mailbox] : chosen.filter((item) => item !== mailbox))
                  }
                />
                <span className="font-mono wrap-anywhere">{mailbox}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function GroupRow({
  group,
  candidates,
  maxMembers,
  editable,
  busy,
  confirming,
  onRemove,
  onSave,
}: {
  group: DomainGroup;
  candidates: string[];
  maxMembers: number;
  editable: boolean;
  busy: Busy;
  confirming: boolean;
  onRemove: () => void;
  onSave: (members: string[]) => Promise<boolean>;
}) {
  const t = useShopCopy();
  const [editing, setEditing] = useState<string[] | null>(null);
  // A member that is no longer one of the buyer's mailboxes is still listed, so that saving does not drop it silently.
  const options = [...new Set([...candidates, ...group.members])];
  return (
    <AddressRow
      address={group.address}
      editable={editable && editing === null}
      busy={busy}
      removing={busy === `remove:${group.id}`}
      confirming={confirming}
      onRemove={onRemove}
    >
      {group.description && <p className="mt-1 text-xs/[1.6] text-muted-foreground">{group.description}</p>}
      {editing === null ? (
        <>
          <p className="mt-1.5 font-mono text-xs/[1.7] wrap-anywhere text-muted-foreground">
            {t.groupMembers}: {group.members.join(", ")}
          </p>
          {editable && (
            <ShopButton
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={busy !== null}
              onClick={() => setEditing(group.members)}
            >
              {t.groupEdit}
            </ShopButton>
          )}
        </>
      ) : (
        <>
          <MemberPicker
            legend={t.groupMembers}
            candidates={options}
            chosen={editing}
            max={maxMembers}
            disabled={busy !== null}
            onChange={setEditing}
          />
          {editing.length === 0 && <p className="mt-2 text-xs/[1.6] text-destructive">{t.groupMembersRequired}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <ShopButton
              type="button"
              size="sm"
              disabled={busy !== null || editing.length === 0}
              onClick={() => void onSave(editing).then((ok) => ok && setEditing(null))}
            >
              {busy === `save:${group.id}` ? t.groupSaving : t.groupSave}
            </ShopButton>
            <ShopButton
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setEditing(null)}
            >
              {t.groupCancel}
            </ShopButton>
          </div>
        </>
      )}
    </AddressRow>
  );
}

function GroupForm({
  id,
  domain,
  candidates,
  maxMembers,
  full,
  busy,
  onSubmit,
}: {
  id: string;
  domain: string;
  candidates: string[];
  maxMembers: number;
  full: boolean;
  busy: Busy;
  onSubmit: (username: string, members: string[], description: string) => Promise<boolean>;
}) {
  const t = useShopCopy();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // A picked mailbox that was deleted meanwhile has no checkbox any more, so it is not part of the group either.
  const members = picked.filter((member) => candidates.includes(member));
  if (full) return <p className="mt-3 text-xs/[1.6] text-muted-foreground">{t.addressLimitReached}</p>;
  return (
    <form
      className="mt-1"
      onSubmit={(event) => {
        event.preventDefault();
        const username = normalizeLocalPart(name, domain);
        if (!username || members.length === 0) return;
        void onSubmit(username, members, description.trim()).then((ok) => {
          if (!ok) return;
          setName("");
          setDescription("");
          setPicked([]);
        });
      }}
    >
      <ShopField htmlFor={`${id}-name`} label={t.addressName}>
        <LocalPartInput id={`${id}-name`} domain={domain} value={name} onChange={setName} disabled={busy !== null} />
      </ShopField>
      <ShopField htmlFor={`${id}-description`} label={t.groupDescription}>
        <Input
          className={cn(shopInputClass, "max-w-105")}
          id={`${id}-description`}
          type="text"
          maxLength={200}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={busy !== null}
        />
      </ShopField>
      <MemberPicker
        legend={t.groupMembers}
        candidates={candidates}
        chosen={members}
        max={maxMembers}
        disabled={busy !== null}
        onChange={setPicked}
      />
      <ShopActions>
        <ShopButton type="submit" disabled={busy !== null || !name.trim() || members.length === 0}>
          {busy === "group" ? t.groupAdding : t.groupAdd}
        </ShopButton>
      </ShopActions>
    </form>
  );
}

function CatchAllForm({
  id,
  current,
  mailboxes,
  editable,
  busy,
  onSubmit,
}: {
  id: string;
  current: string | null;
  mailboxes: string[];
  editable: boolean;
  busy: Busy;
  onSubmit: (destination: string | null) => Promise<boolean>;
}) {
  const t = useShopCopy();
  const [value, setValue] = useState(current ?? "");
  // The current destination stays selectable even when it is not one of the buyer's mailboxes any more.
  const options = current && !mailboxes.includes(current) ? [current, ...mailboxes] : mailboxes;
  if (!editable) return <p className="mt-3 font-mono text-sm/normal wrap-anywhere">{current ?? t.catchAllOff}</p>;
  return (
    <form
      className="mt-1"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(value || null);
      }}
    >
      <ShopField htmlFor={`${id}-target`} label={t.catchAllLabel}>
        <NativeSelect
          className={cn(shopInputClass, "max-w-105 cursor-pointer")}
          id={`${id}-target`}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          disabled={busy !== null}
        >
          <option value="">{t.catchAllOff}</option>
          {options.map((mailbox) => (
            <option key={mailbox} value={mailbox}>
              {mailbox}
            </option>
          ))}
        </NativeSelect>
      </ShopField>
      <ShopButton type="submit" disabled={busy !== null || value === (current ?? "")}>
        {busy === "catch-all" ? t.catchAllSaving : t.catchAllSave}
      </ShopButton>
    </form>
  );
}
