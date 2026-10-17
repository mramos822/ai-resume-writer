import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { alternatesFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { tr, locale } = await getT();
  return { title: tr("Contact"), alternates: alternatesFor("/contact", locale) };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
