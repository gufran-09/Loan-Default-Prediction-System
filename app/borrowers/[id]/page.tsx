"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/dashboard/shell";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function BorrowerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => {
      fetch(`/api/borrowers/${p.id}/score`)
        .then((r) => r.json())
        .then((x) => {
          if (x.error) throw new Error(x.error.message);
          setData(x.data);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, [params]);

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <Link
          href="/borrowers"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to borrowers
        </Link>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Couldn't load this borrower: {error}
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Borrower not found.</p>
        ) : (
          <>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Borrower profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {data.borrower?.full_name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.borrower?.external_id} · {data.borrower?.email}
              </p>
            </div>

            {/* Profile fields */}
            <section className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Loan type" value={data.borrower?.loan_type} />
              <Field label="Loan amount" value={`$${Number(data.borrower?.loan_amount).toLocaleString()}`} />
              <Field label="Outstanding balance" value={`$${Number(data.borrower?.outstanding_balance).toLocaleString()}`} />
              <Field label="Tenure" value={`${data.borrower?.tenure_months} months`} />
              <Field label="Monthly income" value={`$${Number(data.borrower?.monthly_income).toLocaleString()}`} />
              <Field label="Employment" value={data.borrower?.employment_status} />
              <Field label="Geography" value={data.borrower?.geography} />
            </section>

            <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
              <section className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Current risk score</p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="text-6xl font-semibold tracking-tight">{data.score}</span>
                  <span className="mb-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize">
                    {data.bucket}
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Served by {data.model_version} · refreshed{" "}
                  {new Date(data.scored_at).toLocaleDateString()}
                </p>
              </section>

              <section className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-primary" />
                  <h2 className="font-semibold">Why this score?</h2>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  {(data.risk_reasons || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contributing factors recorded.</p>
                  ) : (
                    data.risk_reasons.map((r: any) => (
                      <div key={r.rank}>
                        <div className="flex justify-between gap-4 text-sm">
                          <span>{r.reason}</span>
                          <span className="font-mono text-muted-foreground">
                            {r.impact > 0 ? "+" : ""}
                            {r.impact}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-secondary">
                          <div
                            className={`h-2 rounded-full ${r.impact > 0 ? "bg-destructive" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, Math.abs(r.impact) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value ?? "—"}</p>
    </div>
  );
}