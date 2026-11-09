"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LANG_PATHS, type Lang } from "@/storefront/i18n";
import { getAccount, logoutAccount } from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";

/**
 * The "Logged in: email · Log out" line at the top of every shop page. Orders and renewals placed while logged in belong to this account, so who is logged in must be visible before ordering:
 * a login that is not your own (say, from opening someone else's login link) is spotted here at a glance and logged out. Shows nothing when logged out or when the account cannot be read.
 */
export function ShopSession({ lang, onSignedOut }: { lang: Lang; onSignedOut?: () => void }) {
  const t = shopCopy[lang];
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getAccount(controller.signal, lang)
      .then((account) => {
        if (!controller.signal.aborted) setEmail(account?.email ?? null);
      })
      // Failing to read the account does not block buying: this line simply stays hidden.
      .catch(() => undefined);
    return () => controller.abort();
  }, [lang]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await logoutAccount(lang);
      setEmail(null);
      onSignedOut?.();
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      setBusy(false);
    }
  }

  if (!email) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm/body text-muted-foreground">
      <span>
        <Link className="text-foreground hover:underline" href={`/${LANG_PATHS[lang]}shop/account/`}>
          {t.signedInAs(email)}
        </Link>
        {" · "}
        {t.sessionNote}
      </span>
      <Button variant="link" type="button" disabled={busy} onClick={() => void signOut()}>
        {t.logout}
      </Button>
      {error && (
        <span className="text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
