"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Records one "read" each time the reading room opens. Renders nothing.
 * De-duplicated per issue id so re-renders never double-count, while
 * navigating to another issue counts a fresh read.
 */
export function RegisterRead({ issueId }: { issueId: string }) {
  const counted = useRef<string | null>(null);

  useEffect(() => {
    if (counted.current === issueId) return;
    counted.current = issueId;
    createSupabaseBrowserClient()
      ?.rpc("increment_read", { issue: issueId })
      .then(undefined, () => {});
  }, [issueId]);

  return null;
}
