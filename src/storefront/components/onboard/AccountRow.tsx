"use client";

import { useId } from "react";
import { InputGroup, InputGroupButton, InputGroupInput, InputGroupSuffix } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import type { Copy } from "@/storefront/i18n";
import { cn } from "@/lib/utils";
import { inputActionClass } from "./CopyButton";
import { Msg } from "./Msg";
import type { Row } from "./reducer";

/** Small field label, also used by the options on the redeem page. */
export const fieldLabelClass = "mb-1.5 block text-sm/body text-muted-foreground";

export interface RowInputs {
  username: HTMLInputElement | null;
  password: HTMLInputElement | null;
}

interface Props {
  t: Copy;
  row: Row;
  /** 1-based ordinal. */
  ordinal: number;
  /** With several mailboxes the row starts with "Mailbox N". */
  multiple: boolean;
  domain: string;
  onUsernameInput: (id: number, input: HTMLInputElement) => void;
  onUsernameBlur: (id: number, input: HTMLInputElement) => void;
  onPasswordInput: (id: number, value: string) => void;
  onTogglePassword: (id: number) => void;
  onGeneratePassword: (id: number) => void;
  /** Hands the inputs to the parent so focus can go back on a submit error. */
  register: (id: number, field: keyof RowInputs, input: HTMLInputElement | null) => void;
}

/** One row of the form: one mailbox's username and password, each on a full line with a hint line below. */
export function AccountRow({
  t,
  row,
  ordinal,
  multiple,
  domain,
  onUsernameInput,
  onUsernameBlur,
  onPasswordInput,
  onTogglePassword,
  onGeneratePassword,
  register,
}: Props) {
  const fieldId = useId();
  const usernameId = `${fieldId}-username`;
  const passwordId = `${fieldId}-password`;
  const usernameNoteId = `${usernameId}-note`;
  const passwordNoteId = `${passwordId}-note`;

  return (
    <div>
      <p className="mb-3 text-sm/body font-semibold text-muted-foreground" hidden={!multiple}>
        {t.steps.accounts.ordinal(ordinal)}
      </p>
      <div className="grid gap-4">
        <div className="min-w-0">
          <Label className={fieldLabelClass} htmlFor={usernameId}>
            {t.ui.username}
          </Label>
          <InputGroup className="min-h-10">
            <InputGroupInput
              id={usernameId}
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t.steps.accounts.placeholder}
              maxLength={64}
              aria-label={t.steps.accounts.usernameLabel(ordinal)}
              aria-describedby={usernameNoteId}
              aria-invalid={row.usernameInvalid || undefined}
              value={row.username}
              onChange={(event) => onUsernameInput(row.id, event.currentTarget)}
              onBlur={(event) => onUsernameBlur(row.id, event.currentTarget)}
              ref={(input) => register(row.id, "username", input)}
            />
            <InputGroupSuffix className="max-narrow:mr-1.5 max-narrow:px-1.5 max-narrow:text-xs/body">
              @<span>{domain}</span>
            </InputGroupSuffix>
          </InputGroup>
          <Msg className="empty:hidden" id={usernameNoteId} note={row.usernameNote} />
        </div>
        <div className="min-w-0">
          <Label className={fieldLabelClass} htmlFor={passwordId}>
            {t.ui.password}
          </Label>
          <InputGroup className="min-h-10">
            <InputGroupInput
              className={row.showPassword ? undefined : "max-narrow:placeholder:text-[12px]"}
              id={passwordId}
              type={row.showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t.ui.passwordPlaceholder}
              maxLength={128}
              aria-label={t.steps.accounts.passwordLabel(ordinal)}
              aria-describedby={passwordNoteId}
              aria-invalid={row.passwordInvalid || undefined}
              value={row.password}
              onChange={(event) => onPasswordInput(row.id, event.currentTarget.value)}
              ref={(input) => register(row.id, "password", input)}
            />
            <InputGroupButton
              className={inputActionClass}
              aria-pressed={row.showPassword}
              onClick={() => onTogglePassword(row.id)}
            >
              {row.showPassword ? t.buttons.hide : t.buttons.show}
            </InputGroupButton>
            <InputGroupButton
              className={cn(inputActionClass, "max-narrow:in-data-[slot=input-group]:last:mr-0.5")}
              onClick={() => onGeneratePassword(row.id)}
            >
              {t.buttons.generate}
            </InputGroupButton>
          </InputGroup>
          <Msg className="empty:hidden" id={passwordNoteId} note={row.passwordNote} />
        </div>
      </div>
    </div>
  );
}
