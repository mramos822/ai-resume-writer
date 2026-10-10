"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "@/components/onboarding";
import { useAuth } from "@/context/authContext";

export default function BuildPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // nobody signed in: go through the guest start first
  useEffect(() => {
    if (!loading && !user) router.replace("/start");
    // people with an account use the normal interface
    else if (!loading && user && !user.uid.startsWith("guest-")) router.replace("/home");
  }, [loading, user, router]);

  return <Onboarding />;
}
