import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";

/** Product peers first; personal, team and custom-domain offers remain within Mail below. */
export function Products({ lang }: { lang: Lang }) {
  const { t, links } = useCopy(lang);
  const p = t.products;
  return (
    <Container asChild>
      <section id="products" aria-labelledby="products-title" className="border-t border-border pt-7 pb-10 md:pb-14">
        <Eyebrow lang="en" id="products-title">
          {p.eyebrow}
        </Eyebrow>
        <div className="mt-5 grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          {p.items.map((product, index) => (
            <article
              key={product.name}
              className="flex min-w-0 flex-col items-start py-7 first:pt-0 last:pb-0 md:py-0 md:first:pr-12 md:last:pl-12"
            >
              <div className="flex w-full items-baseline justify-between gap-4">
                <h2 className="font-heading text-3xl/body font-semibold tracking-[-0.02em]" lang="en">
                  {product.name}
                </h2>
                <span className="font-mono text-xs/body text-muted-foreground" aria-hidden="true">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-3 max-w-md text-md/prose text-muted-foreground">{product.description}</p>
              <p className="mt-3 mb-4 text-sm/prose text-muted-foreground">{product.note}</p>
              <TextLink className="mt-auto min-h-11 text-foreground" href={links[product.link]}>
                {product.action} <Icon name="up-right" className="size-4" />
              </TextLink>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-sm/prose text-muted-foreground">
          <p>{p.principle}</p>
          <TextLink className="min-h-11" href={links.status}>
            {p.status} <Icon name="up-right" className="size-3.5" />
          </TextLink>
        </div>
      </section>
    </Container>
  );
}
