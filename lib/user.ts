import type { User } from "@supabase/supabase-js";

export type Profile = {
  avatarUrl: string | null;
  email: string | null;
  firstName: string;
  fullName: string;
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Google sign-in fills user_metadata with full_name / name / avatar_url /
 * picture. Fall back to the email's local part so the header always has
 * something to greet the person with.
 */
export function profileFromUser(user: User): Profile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = readString(user.email);
  const fullName =
    readString(meta.full_name) ??
    readString(meta.name) ??
    (email ? email.split("@")[0] : "İstifadəçi");
  const avatarUrl = readString(meta.avatar_url) ?? readString(meta.picture);
  const firstName = fullName.split(/\s+/)[0] ?? fullName;

  return { avatarUrl, email, firstName, fullName };
}
