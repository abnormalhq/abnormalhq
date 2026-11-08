import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BookIcon,
  CheckIcon,
  CopyIcon,
  MailIcon,
  MenuIcon,
  MessageCircleMoreIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparkleIcon,
  SunIcon,
  TicketIcon,
  UserRoundIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/i18n/types";
import { cn } from "@/lib/utils";

const icons: Record<IconName, LucideIcon> = {
  arrow: ArrowRightIcon,
  "up-right": ArrowUpRightIcon,
  check: CheckIcon,
  plus: PlusIcon,
  close: XIcon,
  menu: MenuIcon,
  shield: ShieldCheckIcon,
  chat: MessageCircleMoreIcon,
  spark: SparkleIcon,
  copy: CopyIcon,
  sun: SunIcon,
  moon: MoonIcon,
  monitor: MonitorIcon,
  cart: ShoppingCartIcon,
  ticket: TicketIcon,
  mail: MailIcon,
  book: BookIcon,
  user: UserRoundIcon,
};

/** The copy picks icons by name (entry cards, process steps), so this keeps a map from names to lucide icons. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Glyph = icons[name];
  return <Glyph className={cn("size-5 shrink-0", className)} strokeWidth={1.6} aria-hidden="true" focusable="false" />;
}
