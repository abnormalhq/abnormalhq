import Link from "next/link";
import { Fragment } from "react";
import { TextLink } from "@/components/ui/text-link";
import { Container } from "@/components/ui/container";
import { site, type Lang } from "@/data/site";
import { getCopy } from "@/i18n";
import { fillTemplate } from "@/lib/template";
import { Brand } from "./Brand";
import { CurrentYear } from "./CurrentYear";
import { Icon } from "./Icon";
import { ServiceStatus } from "./ServiceStatus";

const labelClass = "mb-3 text-sm/[1.6] text-muted-foreground";
const linkClass = "text-base/body text-muted-foreground transition-colors duration-150 hover:text-foreground";

export function Footer({ lang }: { lang: Lang }) {
  const { t, links, path } = getCopy(lang);
  const f = t.footer;
  const productLinks = f.productLinks.map(({ link, label }) => ({ href: links[link], label }));
  const supportLinks = f.supportLinks.map(({ link, label }) => ({ href: links[link], label }));
  const supportEmail = site.contact.email.trim();

  return (
    <footer className="mt-4 border-t border-border">
      <Container>
        <div className="grid grid-cols-2 gap-8 py-10 md:grid-cols-3 md:items-start md:py-14 lg:grid-cols-[1.2fr_0.65fr_0.8fr_1fr_1fr]">
          <div className="col-span-full md:col-auto">
            <Brand lang={lang} />
            <p className="mt-4 text-sm/body text-muted-foreground" lang="en">
              {f.tagline}
            </p>
          </div>
          <nav aria-label={t.products.title}>
            <p className={labelClass}>{t.products.title}</p>
            <ul className="grid gap-2">
              {t.products.items.map((product) => (
                <li key={product.name}>
                  <a className={linkClass} href={links[product.link]}>
                    {product.link === "doppel" ? product.action : product.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={f.productLabel}>
            <p className={labelClass}>{f.productLabel}</p>
            <ul className="grid gap-2">
              {productLinks.map(({ href, label }) => (
                <li key={label}>
                  <a className={linkClass} href={href}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link className={linkClass} href={path("/download/")}>
                  {t.download.navLabel}
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label={f.supportLabel}>
            <p className={labelClass}>{f.supportLabel}</p>
            <ul className="grid gap-2">
              {supportLinks.map(({ href, label }) => (
                <li key={label}>
                  <a className={linkClass} href={href}>
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link className={linkClass} href={path("/#faq")}>
                  {f.faq}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="col-span-full md:col-auto lg:justify-self-end">
            <p className={labelClass}>{f.contactLabel}</p>
            {supportEmail && (
              <TextLink
                variant="inline"
                className="text-md/body font-medium wrap-anywhere"
                href={`mailto:${supportEmail}`}
                aria-label={f.emailAria(supportEmail)}
              >
                {supportEmail}
              </TextLink>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-border py-6 text-sm/[1.7] text-muted-foreground md:flex-row md:items-center md:justify-between md:gap-8">
          <span>
            {fillTemplate(f.copyright, {
              // The prerendered year is a placeholder that CurrentYear replaces in the browser.
              year: <CurrentYear buildYear={new Date().getFullYear()} />,
            }).map((part, index) => (
              <Fragment key={index}>{part}</Fragment>
            ))}
          </span>
          <div className="flex flex-col gap-3 md:items-end card:flex-row card:items-center card:gap-7">
            {/* Shown once the status is known; nothing while it is not (see ServiceStatus). */}
            <ServiceStatus copy={t.serviceStatus} href={links.status} />
            <p>
              <a
                className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-foreground"
                href={links.shop}
              >
                {f.buyOnline} <Icon name="arrow" className="size-3.5" />
              </a>
            </p>
            <nav className="flex gap-5" aria-label={f.legalLabel}>
              {t.legalPages.map(({ path: page, label }) => (
                <Link className="transition-colors hover:text-foreground" href={path(page)} key={page}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </Container>
    </footer>
  );
}
