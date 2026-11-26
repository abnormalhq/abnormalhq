import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface ImageSource {
  src: string;
  srcSet?: string;
}

/**
 * A picture with a version for each theme (the WebMail screenshots, src/lib/screens.ts): two <img>, the dark one shown by the `dark:`
 * variant, which follows <html data-theme> and, before any script, the system's appearance. Both load lazily, and a lazy image that is
 * not displayed is never fetched, so a visitor downloads only the picture of the theme they see; choosing the other theme fetches its
 * picture then. Without `dark` it is one plain <img>.
 */
export function ThemedImage({
  light,
  dark,
  alt,
  className,
  loading = "lazy",
  ...props
}: Omit<ComponentProps<"img">, "src" | "srcSet" | "alt"> & { light: ImageSource; dark?: ImageSource; alt: string }) {
  if (!dark) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} src={light.src} srcSet={light.srcSet} alt={alt} className={className} loading={loading} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        src={light.src}
        srcSet={light.srcSet}
        alt={alt}
        className={cn(className, "dark:hidden")}
        loading="lazy"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        src={dark.src}
        srcSet={dark.srcSet}
        alt={alt}
        className={cn(className, "hidden dark:block")}
        loading="lazy"
      />
    </>
  );
}
