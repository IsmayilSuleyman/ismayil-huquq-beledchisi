"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

/**
 * Records one "read" each time the reading room opens. Renders nothing.
 * Fire-and-forget and de-duplicated per issue id, so re-renders (or React's
 * dev double-invoke) never double-count, while navigating to another issue
 * counts a fresh read.
 */
export default function RegisterRead({ issueId }: { issueId: string }) {
  const counted = useRef<string | null>(null);

  useEffect(() => {
    if (counted.current === issueId) return;
    counted.current = issueId;
    getBrowserSupabase()
      .rpc("increment_read", { issue: issueId })
      .then(undefined, () => {});
  }, [issueId]);

  return null;
}
