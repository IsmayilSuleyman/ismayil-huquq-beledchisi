"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function EditorsPanel({ currentEmail }: { currentEmail: string }) {
  const supabase = createSupabaseBrowserClient();
  const [admins, setAdmins] = useState<string[] | null>(null);
  const [newAdmin, setNewAdmin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function loadAdmins() {
    if (!supabase) {
      setAdmins([]);
      return;
    }
    const { data } = await supabase.from("admin_emails").select("email").order("email");
    setAdmins((data ?? []).map((r) => r.email as string));
  }

  useEffect(() => {
    void loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!supabase) return;
    const email = newAdmin.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMsg("Bu e-poçt ünvanına oxşamır.");
      return;
    }
    const { error } = await supabase.from("admin_emails").insert({ email });
    if (error) {
      setMsg(error.code === "23505" ? "Artıq redaktordur." : error.message);
      return;
    }
    setNewAdmin("");
    await loadAdmins();
  }

  async function removeAdmin(email: string) {
    if (!supabase) return;
    if (email.toLowerCase() === currentEmail.toLowerCase()) return;
    if (!confirm(`${email} redaktorlardan çıxarılsın?`)) return;
    await supabase.from("admin_emails").delete().eq("email", email);
    await loadAdmins();
  }

  return (
    <section className="glass max-w-2xl p-6 sm:p-7">
      <h2 className="mb-1.5 text-xl font-semibold text-ink dark:text-brand-cream">
        Redaktorlar
      </h2>
      <p className="mb-5 text-xs leading-relaxed text-ink/55 dark:text-white/55">
        Nəşr etmək, redaktə etmək və şərhləri idarə etmək hüququ olan e-poçtlar.
        Redaktor eyni e-poçtla Google hesabı vasitəsilə daxil olmalıdır.
      </p>
      {admins === null ? (
        <div className="skeleton h-10 rounded-lg" />
      ) : (
        <ul className="mb-5 space-y-2">
          {admins.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white/50 px-3.5 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <span className="truncate text-ink dark:text-white/90">{email}</span>
              {email.toLowerCase() === currentEmail.toLowerCase() ? (
                <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-ink/45 dark:text-white/45">
                  siz
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void removeAdmin(email)}
                  className="shrink-0 cursor-pointer text-[11px] text-brand-red/75 hover:text-brand-red dark:text-red-300/75"
                >
                  çıxar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addAdmin} className="flex gap-2.5">
        <input
          value={newAdmin}
          onChange={(e) => setNewAdmin(e.target.value)}
          placeholder="hemkar@example.com"
          className="field"
          aria-label="Yeni redaktorun e-poçtu"
        />
        <button type="submit" className="btn btn-ghost shrink-0">
          Əlavə et
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-brand-red dark:text-red-300">{msg}</p>}
    </section>
  );
}
