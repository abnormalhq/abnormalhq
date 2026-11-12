"use client";

import { useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { detectDevice, type DesktopPlatform, type VisitorDevice } from "@/lib/platform";
import { Icon } from "./Icon";

const noSubscription = () => () => {};

function readDevice(): VisitorDevice | null {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  return detectDevice({
    userAgent: nav.userAgent,
    userAgentData: nav.userAgentData,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

/**
 * The visitor's system, read after hydration. The server snapshot is null, so the rendered HTML (the same for everyone, and
 * what a browser without JavaScript keeps) recommends nothing and hydrates without a mismatch.
 */
function useVisitorDevice(): VisitorDevice | null {
  return useSyncExternalStore(noSubscription, readDevice, () => null);
}

/** Beside a platform card's name: marks the download that fits the computer this page is open on. */
export function ForThisComputer({ platform, label }: { platform: DesktopPlatform; label: string }) {
  if (useVisitorDevice() !== platform) return null;
  return (
    <Badge variant="brand" className="ml-auto">
      {label}
    </Badge>
  );
}

/** Above the cards on a phone or tablet: the desktop app does not run there, so point at what does. */
export function PhoneNote({
  copy,
  webmail,
  apps,
}: {
  copy: { title: string; body: string; webmail: string; apps: string };
  webmail: string;
  apps: string;
}) {
  if (useVisitorDevice() !== "phone") return null;
  return (
    <Alert className="mt-8 max-w-2xl">
      <Icon name="phone" aria-hidden="true" />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>
        <p>{copy.body}</p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <TextLink className="text-sm/[1.6]" href={webmail}>
            {copy.webmail} <Icon name="up-right" className="size-3.5" />
          </TextLink>
          <TextLink className="text-sm/[1.6]" href={apps}>
            {copy.apps} <Icon name="arrow" className="size-3.5" />
          </TextLink>
        </p>
      </AlertDescription>
    </Alert>
  );
}
