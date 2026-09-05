"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If session is immediately established (e.g. email confirmation disabled in Supabase)
    if (data.session) {
      window.location.href = "/";
    } else {
      setSuccess(true);
    }
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
              Proactive credit intelligence and monitoring.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70">
              Join your team to detect delinquency patterns, monitor portfolio health, and defend credit decisions.
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

            {success ? (
              <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                  Verification sent
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  We sent a confirmation email to <span className="font-medium text-foreground">{email}</span>. Click the link in that email to activate your account.
                </p>
                <div className="mt-6">
                  <Link
                    href="/signin"
                    className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Risk officer console
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                  Create an account
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Sign up to access your team&apos;s risk dashboard.
                </p>

                <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Full name
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 rounded-lg border border-input bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                      placeholder="Alex Morgan"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm font-medium">
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

                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Password
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-lg border border-input bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                      placeholder="At least 6 characters"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Confirm password
                    <input
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-lg border border-input bg-background px-3 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                      placeholder="Repeat your password"
                    />
                  </label>

                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? "Creating account…" : "Create account"}
                    <ArrowRight className="size-4" />
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/signin" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
