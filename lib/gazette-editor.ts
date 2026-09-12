import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Is the signed-in person on the gazette's editor allow-list? Server-only:
 * it reads the session from cookies. The `admin_emails` select policy only
 * returns rows to admins, so a hit means "editor".
 */
export async function isGazetteEditor(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("admin_emails")
    .select("email")
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    console.error("admin_emails read failed:", error);
    return false;
  }
  return data != null;
}
