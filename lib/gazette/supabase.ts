import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

// The gazette's own Supabase access, as in the standalone app: a
// session-less client for public reads and a browser client whose editor
// session lives in localStorage. All access is enforced by row-level
// security in the database, so the publishable key is safe to expose.
const config = getSupabaseConfig();
export const SUPABASE_URL = config?.url ?? "https://wqgjqljupslpzklmrwqm.supabase.co";
export const SUPABASE_KEY = config?.anonKey ?? "sb_publishable_eglpkiylAZ5O1d-YZSzDcQ_dShoQtws";

const BUCKET = "gazette";

/** Per-request client for server components (no session persistence). */
export function getServerSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

let browserClient: SupabaseClient | undefined;

/** Shared browser client; keeps the admin session in localStorage. */
export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storageKey: "olg-auth" },
    });
  }
  return browserClient;
}

/** Public CDN URL for an object in the gazette bucket. */
export function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export const GAZETTE_BUCKET = BUCKET;
