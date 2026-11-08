"use client";

import { useSyncExternalStore } from "react";
import { ThemePicker as BaseThemePicker } from "@/components/ui/theme-picker";
import type { Copy } from "@/i18n/types";
import { fillTemplate } from "@/lib/template";

type Preference = "system" | "light" | "dark";

// window.abnormalTheme 由头部的 theme-init.js 在水合之前写好；静态 HTML 一律按「跟随系统」输出。
function subscribe(onChange: () => void) {
  window.addEventListener("abnormal:themechange", onChange);
  return () => window.removeEventListener("abnormal:themechange", onChange);
}
const getPreference = () => window.abnormalTheme.getPreference();
const getServerPreference = (): Preference => "system";

/** 页头的主题按钮：registry 的 ThemePicker，偏好读写都走 theme-init.js 挂在 window.abnormalTheme 上的存储。 */
export function ThemePicker({ copy, onOpen }: { copy: Copy["theme"]; onOpen?: () => void }) {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  const current = copy.options[preference];

  return (
    <BaseThemePicker
      value={preference}
      onValueChange={(next) => window.abnormalTheme.setPreference(next)}
      labels={copy.options}
      label={fillTemplate(copy.ariaTemplate, { label: current }).join("")}
      title={fillTemplate(copy.titleTemplate, { label: current }).join("")}
      className="size-9"
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    />
  );
}
