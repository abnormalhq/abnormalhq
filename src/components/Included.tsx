import { IconTile } from "@/components/ui/icon-tile";
import type { Lang } from "@/data/site";
import { useCopy } from "@/i18n";
import { Icon } from "./Icon";

/**
 * "What every mailbox gets": the limits and terms that hold on every plan (own storage, the username rules, the 7-day grace period and
 * 30-day retention, protocols, apps, webmail attachments). They are mail's rules rather than the catalog's, so they are copy
 * (pricing.included) and prerender; the plan cards beside them carry what differs per plan.
 */
export function Included({ lang, heading = "h3", id }: { lang: Lang; heading?: "h2" | "h3"; id: string }) {
  const { t } = useCopy(lang);
  const { included } = t.pricing;
  const Heading = heading;
  const Item = heading === "h2" ? "h3" : "h4";
  return (
    <div>
      <Heading className="flex items-center gap-4 text-sm/body font-medium text-muted-foreground" id={id}>
        {included.title}
        <span className="h-px flex-1 bg-border" aria-hidden="true"></span>
      </Heading>
      <p className="mt-4 max-w-2xl text-base/prose text-muted-foreground">{included.intro}</p>
      <ul className="mt-7 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby={id}>
        {included.items.map((item) => (
          <li className="flex items-start gap-4" key={item.title}>
            <IconTile variant="default" aria-hidden="true">
              <Icon name={item.icon} />
            </IconTile>
            <div className="min-w-0">
              <Item className="text-[17px] leading-[1.4] font-semibold tracking-[-0.01em]">{item.title}</Item>
              <p className="mt-1.5 text-base/prose text-muted-foreground">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
