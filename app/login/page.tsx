"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      setError(
        error.message.toLowerCase().includes("confirm")
          ? "Please confirm your email before signing in."
          : "Invalid email or password.",
      );
    else window.location.href = "/";
    setLoading(false);
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/10">
              <ShieldCheck />
            </div>
            <span className="font-semibold tracking-tight">Aegis Risk</span>
          </div>
          <div className="max-w-lg">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.24em] text-primary-foreground/60">
              Portfolio intelligence / 2026
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight">
              Know where risk is moving before it moves you.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70">
              A focused workspace for monitoring borrower health, surfacing
              early signals, and making defensible credit decisions.
            </p>
          </div>
          <p className="text-xs text-primary-foreground/50">
            Private workspace for authorized risk teams.
          </p>
        </section>
        <section className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck />
              </div>
              <span className="font-semibold">Aegis Risk</span>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Risk officer console
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in to review portfolio signals and borrower exposure.
            </p>
            <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Work email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  placeholder="you@company.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                disabled={loading}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
                <ArrowRight className="size-4" />
              </button>
            </form>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Access is provisioned by your workspace administrator.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
