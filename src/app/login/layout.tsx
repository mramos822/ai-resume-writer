import type { Metadata } from "next";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = await getT();
  return { title: tr("Log in or create an account") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
