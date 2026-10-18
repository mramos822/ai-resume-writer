"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import Onboarding from "@/components/onboarding";
import { useAuth } from "@/context/authContext";

export default function BuildPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // nobody signed in: go through the guest start first
  useEffect(() => {
    // while a guest makes an account the resume is moving: the sign-in window decides where they go next
    let claiming = false;
    try {
      claiming = Date.now() - Number(sessionStorage.getItem("kaizo_claiming") || 0) < 10 * 60 * 1000;
    } catch {
      /* storage unavailable */
    }
    if (claiming) return;
    if (!loading && !user) router.replace("/start");
    // people with an account use the normal interface
    else if (!loading && user && !user.uid.startsWith("guest-")) router.replace("/home");
  }, [loading, user, router]);

  return <Onboarding />;
}
