import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";
import { pendingPilotCohortKey } from "@/lib/pilotCohortAttribution";

/** Claims the browser's active pilot cohort only after authentication succeeds. No user information is rendered or logged. */
export default function CohortSignupAttribution() {
  const { isAuthenticated } = useAuth();
  const claimedCode = useRef<string | null>(null);
  const attribution = trpc.pilot.recordCohortSignup.useMutation();

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    const code = sessionStorage.getItem(pendingPilotCohortKey);
    if (!code || claimedCode.current === code) return;

    claimedCode.current = code;
    attribution.mutate(
      { code },
      {
        onSuccess: () => {
          sessionStorage.removeItem(pendingPilotCohortKey);
        },
        onError: () => {
          // Retain the cohort marker for a later retry, without blocking the signed-in experience.
          claimedCode.current = null;
        },
      }
    );
  }, [attribution, isAuthenticated]);

  return null;
}
