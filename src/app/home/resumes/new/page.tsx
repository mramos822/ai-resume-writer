"use client";

// "Create resume": the builder inside the dashboard (its top bar and menu stay), with every detail on the left and the
// live preview on the right. The full-screen version of the builder is only for the first time (see components/onboarding).
// With ?edit=<file>&look=<look> it opens on a resume that was already made: "Save changes" replaces it instead of adding another one.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Onboarding from "@/components/onboarding";

function Builder() {
  const q = useSearchParams();
  return <Onboarding embedded opened={{ edit: q.get("edit"), look: q.get("look") }} />;
}

export default function NewResumePage() {
  return (
    <Suspense fallback={null}>
      <Builder />
    </Suspense>
  );
}
