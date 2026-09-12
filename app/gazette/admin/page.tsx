import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { isGazetteEditor } from "@/lib/gazette-editor";
import { profileFromUser } from "@/lib/user";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdminDesk } from "@/components/gazette/admin/AdminDesk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Redaktor masası · Omni Law Gazette",
  robots: { index: false, follow: false },
};

export default async function GazetteAdminPage() {
  const user = await requireUser("/gazette/admin");
  const profile = profileFromUser(user);
  const editor = await isGazetteEditor(user.email);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-16">
      <AppHeader name={profile.firstName} avatarUrl={profile.avatarUrl} />
      <Breadcrumbs
        items={[
          { href: "/gazette", label: "Qəzet" },
          { label: "Redaktor masası" },
        ]}
      />

      <header className="mb-8">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-brass">
          Omni Law Gazette
        </div>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-tight tracking-[-0.02em] text-ink dark:text-brand-cream">
          Redaktor masası
        </h1>
        <p className="mt-2 text-sm text-ink/55 dark:text-white/55">{profile.email}</p>
      </header>

      {editor ? (
        <AdminDesk email={profile.email ?? ""} />
      ) : (
        <div className="glass max-w-xl p-8">
          <p className="text-xl font-semibold text-ink dark:text-brand-cream">
            Bu bölmə yalnız redaktorlar üçündür.
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/55 dark:text-white/55">
            Hesabınız ({profile.email}) redaktor siyahısında deyil. Siyahıya mövcud
            redaktor əlavə edə bilər.
          </p>
          <Link href="/gazette" className="btn btn-ghost mt-6">
            Qəzetə qayıt
          </Link>
        </div>
      )}
    </main>
  );
}
