"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import ManageIssues from "@/components/gazette/admin/ManageIssues";
import PublishForm from "@/components/gazette/admin/PublishForm";
import SettingsPanel from "@/components/gazette/admin/SettingsPanel";
import SignInCard from "@/components/gazette/admin/SignInCard";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

type Tab = "publish" | "manage" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish issue" },
  { id: "manage", label: "Manage issues" },
  { id: "settings", label: "Settings" },
];

export default function AdminPage() {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("publish");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (session === undefined) {
    return (
      <div className="py-24 grid place-items-center">
        <div className="olg-skeleton w-full max-w-md h-72 rounded-3xl" />
      </div>
    );
  }

  if (!session) return <SignInCard />;

  const email = session.user.email ?? "";

  return (
    <div className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="olg-eyebrow mb-2">Admin desk</p>
          <h1 className="font-serif text-3xl sm:text-4xl">Editor’s room</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-silver hidden sm:block">{email}</span>
          <button className="olg-btn olg-btn-ghost !py-2" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-7 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`olg-btn !py-2.5 ${tab === t.id ? "olg-btn-primary" : "olg-btn-ghost"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "publish" && <PublishForm />}
      {tab === "manage" && <ManageIssues />}
      {tab === "settings" && <SettingsPanel currentEmail={email} />}
    </div>
  );
}
