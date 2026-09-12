"use client";

import { useState } from "react";
import Logo from "@/components/gazette/Logo";
import { getBrowserSupabase } from "@/lib/gazette/supabase";

export default function SignInCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await getBrowserSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError("Sign-in failed. Check the email and password.");
    // success: the auth listener on the page swaps in the dashboard
  }

  return (
    <div className="min-h-[60vh] grid place-items-center py-16">
      <div className="olg-glass-deep rounded-3xl p-9 sm:p-11 w-full max-w-md olg-rise">
        <div className="flex justify-center mb-7">
          <Logo size="md" href={null} />
        </div>
        <h1 className="font-serif text-2xl text-center">Admin desk</h1>
        <p className="text-sm text-silver text-center mt-1.5 mb-8">
          Sign in to publish and manage weekly issues.
        </p>
        <form onSubmit={signIn} className="space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="olg-field"
            aria-label="Email"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="olg-field"
            aria-label="Password"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="olg-btn olg-btn-primary w-full !py-3">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-[0.7rem] text-silver text-center mt-6 leading-relaxed">
          Readers don’t need an account — this door is only for the editor.
        </p>
      </div>
    </div>
  );
}
