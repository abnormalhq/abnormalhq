"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LANG_PATHS, storePath, type Lang } from "@/storefront/i18n";
import {
  createShopOrder,
  getShopCatalog,
  type ShopCatalog,
  formatMoney,
  type ShopPaymentProvider,
} from "@/storefront/lib/shop";
import { shopCopy, shopError } from "@/storefront/lib/shop-copy";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { ShopDetails } from "./ShopDetails";
import {
  ShopAlert,
  ShopButton,
  ShopField,
  ShopHero,
  ShopTextLink,
  shopEmptyClass,
  shopHeadingClass,
  shopHeadingRowClass,
  shopInputClass,
  shopNoteClass,
  shopPageClass,
  shopTextClass,
} from "./ShopParts";
import { ShopPrice } from "./ShopPrice";
import { ShopSession } from "./ShopSession";

export function Shop({ lang }: { lang: Lang }) {
  const t = shopCopy[lang];
  const router = useRouter();
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const checkoutLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    getShopCatalog(controller.signal, lang)
      .then(setCatalog)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(shopError(error, lang));
      });
    return () => controller.abort();
  }, [attempt, lang]);

  async function checkout(productId: string, provider: ShopPaymentProvider = "ldc") {
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setBuying(`${productId}:${provider}`);
    setCheckoutError("");
    try {
      const id = await createShopOrder(productId, lang, email.trim(), provider);
      router.push(`/${LANG_PATHS[lang]}shop/orders/?id=${encodeURIComponent(id)}`);
    } catch (error) {
      setCheckoutError(shopError(error, lang));
      setBuying(null);
      checkoutLock.current = false;
    }
  }

  return (
    <div className={shopPageClass}>
      <div className={shopHeadingRowClass}>
        <ShopTextLink href={storePath(lang)}>← {t.back}</ShopTextLink>
        <span className="flex flex-wrap gap-4">
          <ShopTextLink href={`/${LANG_PATHS[lang]}shop/orders/`}>{t.orderLink} ↗</ShopTextLink>
          <ShopTextLink href={`/${LANG_PATHS[lang]}shop/account/`}>{t.accountNav} ↗</ShopTextLink>
        </span>
      </div>
      <ShopSession lang={lang} />
      <ShopHero eyebrow={t.eyebrow} title={t.title}>
        {t.description}
      </ShopHero>

      {loadError ? (
        <Card asChild className={shopEmptyClass}>
          <div>
            <p className={shopTextClass} role="alert">
              {loadError}
            </p>
            <ShopButton
              variant="outline"
              className="mt-[18px]"
              onClick={() => {
                setLoadError("");
                setAttempt((value) => value + 1);
              }}
            >
              {t.retry}
            </ShopButton>
          </div>
        </Card>
      ) : !catalog ? (
        <Card asChild className={shopEmptyClass}>
          <p role="status">{t.loading}</p>
        </Card>
      ) : !catalog.available || catalog.products.length === 0 ? (
        <Card className={shopEmptyClass}>
          <h2 className="text-xl">{t.closed}</h2>
          <p className={shopTextClass}>{t.closedDescription}</p>
        </Card>
      ) : (
        <section aria-labelledby="shop-products-title">
          <div>
            <h2 className={shopHeadingClass} id="shop-products-title">
              {t.choose}
            </h2>
            <p className={shopTextClass}>{t.pricing}</p>
          </div>
          {catalog.products.some((product) => product.periodDays) && (
            <ShopField
              htmlFor="shop-contact-email"
              label={t.emailLabel}
              hint={t.emailHint}
              hintId="shop-contact-email-hint"
            >
              <Input
                className={cn(shopInputClass, "max-w-[420px]")}
                id="shop-contact-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby="shop-contact-email-hint"
              />
            </ShopField>
          )}
          {checkoutError && <ShopAlert>{checkoutError}</ShopAlert>}
          {/* Each card spans four rows of the shared grid (heading, price, details, actions) through subgrid, so
              prices, detail lists and buttons line up across the cards in a row whatever the description length. */}
          <div className="mt-[26px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-5">
            {catalog.products.map((product) => {
              const cardPrice =
                catalog.payment.stripe && product.fiatPriceMinor
                  ? formatMoney(product.fiatPriceMinor, catalog.payment.stripe.currency, lang)
                  : null;
              return (
                <Card
                  asChild
                  className="row-span-4 grid grid-rows-subgrid gap-y-0 p-7 max-narrow:px-5 max-narrow:py-[22px]"
                  key={product.id}
                >
                  <article>
                    <div>
                      {/* The a↗ in the plan card's top-left corner echoes the brand mark: highlight yellow square with ink text. */}
                      <IconTile variant="highlight" className="mb-[22px] size-[38px] text-[22px]" aria-hidden="true">
                        a↗
                      </IconTile>
                      <h3 className="text-xl wrap-anywhere">{product.name}</h3>
                      {product.description && (
                        <p className="mt-3 text-sm/[1.7] whitespace-pre-line wrap-anywhere text-muted-foreground">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col py-[26px]">
                      {catalog.payment.ldc && <ShopPrice item={product} lang={lang} purchase className="my-0" />}
                      {cardPrice ? (
                        <p
                          className={cn(
                            "text-sm/body",
                            catalog.payment.ldc ? "mt-auto pt-4 text-muted-foreground" : "font-semibold",
                          )}
                        >
                          {t.cardPrice(cardPrice, product.periodDays ?? 0)}
                        </p>
                      ) : null}
                    </div>
                    <ShopDetails item={product} lang={lang} />
                    <div className="flex flex-wrap gap-2 pt-6">
                      {catalog.payment.ldc && (
                        <ShopButton
                          type="button"
                          disabled={buying !== null}
                          onClick={() => void checkout(product.id)}
                          aria-label={`${t.buy} · ${product.name}`}
                        >
                          {buying === `${product.id}:ldc` ? t.buying : t.buy}
                          <span aria-hidden="true">↗</span>
                        </ShopButton>
                      )}
                      {cardPrice ? (
                        <ShopButton
                          variant={catalog.payment.ldc ? "outline" : "default"}
                          type="button"
                          disabled={buying !== null}
                          onClick={() => void checkout(product.id, "stripe")}
                          aria-label={`${t.payCard} · ${product.name}`}
                        >
                          {buying === `${product.id}:stripe` ? t.buying : t.payCard}
                          <span aria-hidden="true">↗</span>
                        </ShopButton>
                      ) : null}
                    </div>
                  </article>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-12 border-t border-border pt-8">
        <h2 className={shopHeadingClass}>{t.processTitle}</h2>
        <ol className="mt-6 grid grid-cols-3 gap-7 max-narrow:grid-cols-[1fr] max-narrow:gap-[18px]">
          {t.steps.map((step, index) => (
            <li className="text-base/[1.8] max-narrow:flex max-narrow:gap-4" key={step}>
              <span className="mb-2.5 block text-xs/[1.8] text-muted-foreground max-narrow:mb-0" aria-hidden="true">
                0{index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className={shopTextClass}>{t.expiryNote}</p>
      </section>
      <p className={shopNoteClass}>{t.browserNote}</p>
    </div>
  );
}
