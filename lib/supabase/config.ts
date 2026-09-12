export type SupabaseConfig = {
  anonKey: string;
  url: string;
};

function readEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = readEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = readEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
    return null;
  }

  return { anonKey, url };
}

export function hasSupabaseConfig(): boolean {
  return getSupabaseConfig() != null;
}
