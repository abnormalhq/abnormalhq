"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/storefront/i18n";
import { claimTrial, getTrial, trialCopy, type TrialOffer } from "@/storefront/lib/trial";
import { shopError } from "@/storefront/lib/shop-copy";
import { ShopAlert, ShopButton, ShopPanel, shopHeadingClass, shopTextClass } from "./ShopParts";

export function ShopTrial({ lang, onClaimed }: { lang: Lang; onClaimed: () => void }) {
  const t = trialCopy[lang];
  const [offer, setOffer] = useState<TrialOffer | null>(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    getTrial(controller.signal, lang)
      .then((value) => {
        if (!controller.signal.aborted) setOffer(value);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(shopError(cause, lang));
      });
    return () => controller.abort();
  }, [lang]);
  async function claim() {
    if (lock.current) return;
    lock.current = true;
    setClaiming(true);
    setError("");
    try {
      const orderId = await claimTrial(lang);
      setOffer({ claimed: true, orderId });
      onClaimed();
    } catch (cause) {
      setError(shopError(cause, lang));
    } finally {
      setClaiming(false);
      lock.current = false;
    }
  }
  if (!offer && !error) return null;
  return (
    <ShopPanel>
      <h2 className={shopHeadingClass}>{t.title}</h2>
      {error && <ShopAlert>{error}</ShopAlert>}
      {offer?.claimed ? (
        <p className={shopTextClass}>{t.claimed}</p>
      ) : offer ? (
        <>
          <p className={shopTextClass}>{t.description(offer.days, offer.quotaMb)}</p>
          <p className={shopTextClass}>{offer.domains.map((domain) => `@${domain}`).join(" · ")}</p>
          <p className={shopTextClass}>{t.expiry}</p>
          <ShopButton type="button" disabled={claiming} onClick={() => void claim()}>
            {claiming ? t.starting : t.start}
          </ShopButton>
        </>
      ) : null}
    </ShopPanel>
  );
}
