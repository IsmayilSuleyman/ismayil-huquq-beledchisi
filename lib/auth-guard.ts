import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerUser } from "@/lib/supabase/server";

/**
 * Server-side gate for signed-in pages. Redirects to the landing page with a
 * setup hint when Supabase isn't configured, and to /login (remembering the
 * requested path) when there is no session.
 */
export async function requireUser(loginRedirect?: string): Promise<User> {
  const { reason, user } = await getSupabaseServerUser();

  if (reason === "missing_config") {
    redirect("/?setup=supabase");
  }

  if (reason === "error" || !user) {
    redirect(
      loginRedirect ? `/login?next=${encodeURIComponent(loginRedirect)}` : "/login",
    );
  }

  return user;
}
