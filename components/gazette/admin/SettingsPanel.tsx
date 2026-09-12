"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

export default function SettingsPanel({ currentEmail }: { currentEmail: string }) {
  const supabase = getBrowserSupabase();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [admins, setAdmins] = useState<string[] | null>(null);
  const [newAdmin, setNewAdmin] = useState("");
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  async function loadAdmins() {
    const { data } = await supabase.from("admin_emails").select("email").order("email");
    setAdmins((data ?? []).map((r) => r.email as string));
  }

  useEffect(() => {
    void loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw1.length < 8) return setPwMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw1 !== pw2) return setPwMsg({ ok: false, text: "Passwords don’t match." });
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) return setPwMsg({ ok: false, text: error.message });
    setPw1("");
    setPw2("");
    setPwMsg({ ok: true, text: "Password updated." });
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminMsg(null);
    const email = newAdmin.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setAdminMsg("That doesn’t look like an email address.");
      return;
    }
    const { error } = await supabase.from("admin_emails").insert({ email });
    if (error) {
      setAdminMsg(error.code === "23505" ? "Already an admin." : error.message);
      return;
    }
    setNewAdmin("");
    await loadAdmins();
  }

  async function removeAdmin(email: string) {
    if (email.toLowerCase() === currentEmail.toLowerCase()) return;
    if (!confirm(`Remove ${email} from admins?`)) return;
    await supabase.from("admin_emails").delete().eq("email", email);
    await loadAdmins();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section className="olg-glass rounded-2xl p-6 sm:p-7">
        <h2 className="font-serif text-xl mb-1.5">Change password</h2>
        <p className="text-xs text-silver mb-5">For the account {currentEmail}.</p>
        <form onSubmit={changePassword} className="space-y-3.5">
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="New password (min. 8 characters)"
            autoComplete="new-password"
            className="olg-field"
            aria-label="New password"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            className="olg-field"
            aria-label="Repeat new password"
          />
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? "text-emerald-300" : "text-red-300"}`}>
              {pwMsg.text}
            </p>
          )}
          <button type="submit" disabled={pwBusy} className="olg-btn olg-btn-primary">
            {pwBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      <section className="olg-glass rounded-2xl p-6 sm:p-7">
        <h2 className="font-serif text-xl mb-1.5">Editors</h2>
        <p className="text-xs text-silver mb-5 leading-relaxed">
          Emails allowed to publish, edit and moderate. (Each editor also needs a sign-in account
          — ask your developer to add one.)
        </p>
        {admins === null ? (
          <div className="olg-skeleton h-10 rounded-lg" />
        ) : (
          <ul className="space-y-2 mb-5">
            {admins.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between gap-3 text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3.5 py-2.5"
              >
                <span className="truncate">{email}</span>
                {email.toLowerCase() === currentEmail.toLowerCase() ? (
                  <span className="text-[0.65rem] text-silver shrink-0">you</span>
                ) : (
                  <button
                    onClick={() => void removeAdmin(email)}
                    className="text-[0.7rem] text-red-300/75 hover:text-red-300 shrink-0 cursor-pointer"
                  >
                    remove
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
            placeholder="colleague@omni.example"
            className="olg-field"
            aria-label="New editor email"
          />
          <button type="submit" className="olg-btn olg-btn-ghost shrink-0">
            Add
          </button>
        </form>
        {adminMsg && <p className="text-sm text-red-300 mt-3">{adminMsg}</p>}
      </section>
    </div>
  );
}
