"use client";

import { useState } from "react";
import { EditorsPanel } from "@/components/gazette/admin/EditorsPanel";
import { ManageIssues } from "@/components/gazette/admin/ManageIssues";
import { PublishForm } from "@/components/gazette/admin/PublishForm";

type Tab = "publish" | "manage" | "editors";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Buraxılış nəşr et" },
  { id: "manage", label: "Buraxılışlar" },
  { id: "editors", label: "Redaktorlar" },
];

export function AdminDesk({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`btn !py-2.5 ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "publish" && <PublishForm />}
      {tab === "manage" && <ManageIssues />}
      {tab === "editors" && <EditorsPanel currentEmail={email} />}
    </div>
  );
}
