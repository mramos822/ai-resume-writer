"use client";

// Links and navigation that keep the person in their language: inside Spanish every address of the site gets /es in front.
// Use these instead of the ones from next/link and next/navigation.
import React from "react";
import NextLink from "next/link";
import { useRouter as useNextRouter, usePathname as useNextPathname } from "next/navigation";
import { useLocale } from "@/i18n/provider";
import { stripLocale, withLocale } from "@/i18n/config";

type LinkProps = Omit<React.ComponentProps<typeof NextLink>, "href"> & { href: string };

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, ...props }, ref) {
  const locale = useLocale();
  return <NextLink ref={ref} href={withLocale(href, locale)} {...props} />;
});
export default Link;

export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale();
  return React.useMemo(
    () => ({
      ...router,
      push: (href: string, opts?: Parameters<typeof router.push>[1]) => (opts === undefined ? router.push(withLocale(href, locale)) : router.push(withLocale(href, locale), opts)),
      replace: (href: string, opts?: Parameters<typeof router.replace>[1]) => (opts === undefined ? router.replace(withLocale(href, locale)) : router.replace(withLocale(href, locale), opts)),
      prefetch: (href: string) => router.prefetch(withLocale(href, locale)),
    }),
    [router, locale]
  );
}

/** The address without the language prefix: "/es/home" is "/home" here. */
export function usePathname() {
  return stripLocale(useNextPathname() ?? "/");
}
