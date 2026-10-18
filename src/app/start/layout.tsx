import type { Metadata } from "next";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { tr } = await getT();
  return { title: tr("Create your resume") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
