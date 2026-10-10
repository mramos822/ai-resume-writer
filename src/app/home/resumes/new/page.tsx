"use client";

// "Create resume": the builder inside the dashboard (its top bar and menu stay), with every detail on the left and the
// live preview on the right. The full-screen version of the builder is only for the first time (see components/onboarding).
import Onboarding from "@/components/onboarding";

export default function NewResumePage() {
  return <Onboarding embedded />;
}
