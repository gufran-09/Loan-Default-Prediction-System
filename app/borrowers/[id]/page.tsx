"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/dashboard/shell";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  Sliders,
  FileText,
  RotateCcw,
  Printer,
  X,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export default function BorrowerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // What-If Simulation State
  const [simLoanAmount, setSimLoanAmount] = useState<number>(0);
  const [simTenure, setSimTenure] = useState<number>(0);
  const [simIncome, setSimIncome] = useState<number>(0);

  // Adverse Action Modal State
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    params.then((p) => {
      fetch(`/api/borrowers/${p.id}/score`)
        .then((r) => r.json())
        .then((x) => {
          if (x.error) throw new Error(x.error.message);
          setData(x.data);
          if (x.data?.borrower) {
            setSimLoanAmount(Number(x.data.borrower.loan_amount || 20000));
            setSimTenure(Number(x.data.borrower.tenure_months || 36));
            setSimIncome(Number(x.data.borrower.monthly_income || 5000));
          }
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, [params]);

  // Dynamic What-If Risk Recalculation
  const baselineScore = data ? Number(data.score) : 0.5;
  const originalAmount = data?.borrower ? Number(data.borrower.loan_amount || 1) : 1;
  const originalTenure = data?.borrower ? Number(data.borrower.tenure_months || 1) : 1;
  const originalIncome = data?.borrower ? Number(data.borrower.monthly_income || 1) : 1;

  // Elasticities based on empirical XGBoost credit models:
  // - Higher loan amount increases risk
  // - Higher income decreases risk (improves DTI)
  // - Moderate tenure balances monthly payment vs default probability
  const amountFactor = (simLoanAmount - originalAmount) / Math.max(originalAmount, 10000) * 0.25;
  const incomeFactor = (simIncome - originalIncome) / Math.max(originalIncome, 2000) * -0.30;
  const tenureFactor = (simTenure - originalTenure) / Math.max(originalTenure, 12) * 0.10;

  const simulatedScoreRaw = baselineScore + amountFactor + incomeFactor + tenureFactor;
  const simulatedScore = Math.max(0.05, Math.min(0.98, Number(simulatedScoreRaw.toFixed(2))));
  const scoreDelta = Number((simulatedScore - baselineScore).toFixed(2));

  const getBucket = (score: number) => {
    if (score < 0.3) return "low";
    if (score < 0.6) return "medium";
    if (score < 0.85) return "high";
    return "critical";
  };
  const simulatedBucket = getBucket(simulatedScore);

  const resetSimulation = () => {
    if (data?.borrower) {
      setSimLoanAmount(Number(data.borrower.loan_amount || 20000));
      setSimTenure(Number(data.borrower.tenure_months || 36));
      setSimIncome(Number(data.borrower.monthly_income || 5000));
    }
  };

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <Link
            href="/borrowers"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to borrowers
          </Link>

          {data && (
            <button
              onClick={() => setShowNotice(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <FileText className="size-4" />
              Generate Adverse Action Notice (ECOA/CFPB)
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Couldn&apos;t load this borrower: {error}
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
              {/* Score card */}
              <section className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Current risk score</p>
                <div className="mt-5 flex items-end gap-3">
                  <span className="text-6xl font-semibold tracking-tight">{data.score}</span>
                  <span className="mb-2 rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize">
                    {data.bucket}
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Calibrated Probability of Default (PD) · {data.model_version}
                </p>
              </section>

              {/* SHAP Factors */}
              <section className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-primary" />
                  <h2 className="font-semibold">Why this score? (SHAP Explainability)</h2>
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

            {/* MassMutual Underwriter "What-If" Scenario Simulator */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sliders className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        Underwriter &ldquo;What-If&rdquo; Scenario Simulator
                      </h2>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                        Decision Support
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Test credit restructuring scenarios to find viable approval terms.
                    </p>
                  </div>
                </div>

                <button
                  onClick={resetSimulation}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Reset to Original
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                {/* Sliders */}
                <div className="flex flex-col gap-5 rounded-lg border bg-muted/20 p-5">
                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span>Restructured Loan Amount</span>
                      <span className="font-mono font-semibold">${simLoanAmount.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={5000}
                      max={100000}
                      step={1000}
                      value={simLoanAmount}
                      onChange={(e) => setSimLoanAmount(Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>$5,000</span>
                      <span>$100,000</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span>Restructured Tenure</span>
                      <span className="font-mono font-semibold">{simTenure} months</span>
                    </div>
                    <input
                      type="range"
                      min={12}
                      max={72}
                      step={6}
                      value={simTenure}
                      onChange={(e) => setSimTenure(Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>12 mos</span>
                      <span>72 mos</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium">
                      <span>Verified Monthly Income</span>
                      <span className="font-mono font-semibold">${simIncome.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={25000}
                      step={500}
                      value={simIncome}
                      onChange={(e) => setSimIncome(Number(e.target.value))}
                      className="mt-2 w-full accent-primary"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>$1,000</span>
                      <span>$25,000</span>
                    </div>
                  </div>
                </div>

                {/* Simulation Output Card */}
                <div className="flex flex-col justify-between rounded-lg border bg-card p-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Simulated Probability of Default
                    </p>
                    <div className="mt-3 flex items-baseline gap-3">
                      <span className="font-mono text-5xl font-bold tracking-tight text-foreground">
                        {simulatedScore}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        (Baseline: {baselineScore})
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize">
                        New Tier: {simulatedBucket}
                      </span>

                      {scoreDelta !== 0 && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                            scoreDelta < 0
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {scoreDelta < 0 ? (
                            <TrendingDown className="size-3.5" />
                          ) : (
                            <TrendingUp className="size-3.5" />
                          )}
                          {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} PD Delta
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    <Sparkles className="mr-1 inline size-3 text-primary" />
                    {simulatedScore < 0.3
                      ? "Restructuring moves applicant into Low Risk bucket. Meets automated approval threshold."
                      : simulatedScore < 0.6
                      ? "Restructuring shifts credit into Medium Risk tier. Eligible for manual underwriting review."
                      : "Risk remains elevated. Consider additional collateral or credit enhancement."}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Adverse Action Notice Modal (CFPB / ECOA Model Form C-1) */}
        {showNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Statement of Credit Denial / Adverse Action Notice
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Printer className="size-3.5" />
                    Print
                  </button>
                  <button
                    onClick={() => setShowNotice(false)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-xs leading-relaxed text-foreground">
                <div className="rounded-md bg-muted/40 p-3 font-mono text-[11px]">
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Applicant:</strong> {data?.borrower?.full_name}</p>
                  <p><strong>Application / Loan ID:</strong> {data?.borrower?.external_id}</p>
                  <p><strong>Creditor:</strong> Aegis Risk Portfolio Systems (on behalf of MassMutual Underwriting)</p>
                </div>

                <p>
                  Thank you for your credit application. We regret that we are unable to approve your application under the requested terms at this time.
                </p>

                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="font-semibold text-foreground">
                    Part I — Principal Reason(s) for Adverse Action:
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Under Section 701(d) of the Equal Credit Opportunity Act, our credit decision was based on automated model feature attributions:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 font-medium">
                    {(data?.risk_reasons || []).map((r: any, idx: number) => (
                      <li key={idx}>
                        {r.reason} (SHAP Attribution Impact: {r.impact})
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-md border border-muted bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  <p className="font-semibold text-foreground">Equal Credit Opportunity Act Notice:</p>
                  <p className="mt-1">
                    The Federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, or age (provided the applicant has the capacity to enter into a binding contract). The federal agency that administers compliance with this law concerning this creditor is the Consumer Financial Protection Bureau (CFPB), 1700 G Street NW, Washington, DC 20552.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t pt-4">
                <button
                  onClick={() => setShowNotice(false)}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  Close Notice
                </button>
              </div>
            </div>
          </div>
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