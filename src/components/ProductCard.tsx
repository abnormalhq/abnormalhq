import { MailIcon, SlidersVerticalIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { reveal } from "@/lib/reveal";
import type { Product, ProductIcon } from "@/i18n/types";
import { Icon } from "./Icon";
import { InquiryButton } from "./InquiryDialog";

const glyphClass = "size-[22px]";
const glyphs: Record<ProductIcon, ReactNode> = {
  mail: <MailIcon className={glyphClass} strokeWidth={1.5} />,
  domain: <span className="text-[1.6rem] leading-none font-medium">@</span>,
  team: <UsersIcon className={glyphClass} strokeWidth={1.5} />,
  setup: <SlidersVerticalIcon className={glyphClass} strokeWidth={1.5} />,
};

export function ProductCard({ lang, product, index }: { lang: Lang; product: Product; index: number }) {
  const { t, links } = useCopy(lang);
  const variant = product.featured ? "default" : "outline";
  const actionClass = "mt-5 w-full justify-between";

  return (
    <Card
      asChild
      variant={product.featured ? "featured" : "interactive"}
      className="relative px-[1.4rem] pt-6 pb-[1.4rem] max-card:px-[1.1rem] max-lg:px-[1.4rem] max-sm:p-6"
      {...reveal(index)}
    >
      <article>
        <div className="flex items-center justify-between gap-[0.7rem]">
          <IconTile variant={product.featured ? "highlight" : "default"} aria-hidden="true">
            {glyphs[product.icon]}
          </IconTile>
          <Badge className="h-auto border-0 py-0.5 leading-[1.55]">{product.category}</Badge>
        </div>
        <h3 className="mt-6 flex items-center justify-between text-xl/[1.4] max-sm:mt-[1.1rem]">
          {product.name}
          <span className="text-xs/[1.4] font-normal tracking-normal text-muted-foreground" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
        </h3>
        <p className="mt-[0.6rem] flex-1 text-base/prose text-muted-foreground max-sm:max-w-[28rem]">
          {product.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs/body text-muted-foreground max-card:gap-x-2.5 max-lg:gap-x-3.5 max-sm:mt-4">
          {product.tags.map((tag) => (
            <span className="inline-flex items-center gap-[5px]" key={tag}>
              <Icon name="check" className="size-3 text-foreground" />
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-[1.4rem] flex flex-col gap-1 border-t border-border pt-[1.2rem] max-sm:mt-[1.2rem]">
          <strong className="text-xl/body font-semibold tracking-[-0.02em]">
            {product.price || t.services.priceFallback}
          </strong>
          <span className="text-xs/body text-muted-foreground">{product.priceNote}</span>
        </div>
        {product.link ? (
          <Button asChild variant={variant} size="lg" className={actionClass}>
            <a href={links[product.link]}>
              {product.actionLabel}
              <Icon name="up-right" className="size-4" />
            </a>
          </Button>
        ) : (
          <InquiryButton product={product.name}>
            <Button
              variant={variant}
              size="lg"
              className={actionClass}
              aria-label={t.services.consultAria(product.name)}
            >
              {t.services.consult} <Icon name="up-right" className="size-4" />
            </Button>
          </InquiryButton>
        )}
      </article>
    </Card>
  );
}
