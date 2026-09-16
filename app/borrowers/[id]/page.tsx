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
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Landmark,
  History,
  Users,
  HeartPulse,
  CreditCard,
  Activity,
  CheckCircle2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { generateLimeCards, LimeCard } from "@/lib/scoring/explainability";

export default function BorrowerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Alternative Credit & Scoring History State
  const [altCredit, setAltCredit] = useState<any[]>([]);
  const [scoringHistory, setScoringHistory] = useState<any[]>([]);
  const [liveRescoreLoading, setLiveRescoreLoading] = useState(false);

  // What-If Simulation State
  const [simLoanAmount, setSimLoanAmount] = useState<number>(0);
  const [simTenure, setSimTenure] = useState<number>(0);
  const [simIncome, setSimIncome] = useState<number>(0);

  // Adverse Action Modal State
  const [showNotice, setShowNotice] = useState(false);

  // AWS Bedrock GenAI Credit Memo State
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoLoading, setMemoLoading] = useState(false);
  const [creditMemo, setCreditMemo] = useState<string | null>(null);

  const fetchCreditMemo = async () => {
    if (!data) return;
    setMemoLoading(true);
    setShowMemoModal(true);
    try {
      const res = await fetch(`/api/borrowers/${data.borrower.id}/memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowerName: data.borrower.full_name,
          loanAmount: data.borrower.loan_amount,
          monthlyIncome: data.borrower.monthly_income,
          tenureMonths: data.borrower.tenure_months,
          score: data.score,
          bucket: data.bucket,
          riskReasons: data.risk_reasons,
        }),
      });
      const result = await res.json();
      setCreditMemo(result.memo);
    } catch (e) {
      setCreditMemo("Unable to generate automated memo. Please try again.");
    } finally {
      setMemoLoading(false);
    }
  };

  // WhatsApp Notification State

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waPhoneNumber, setWaPhoneNumber] = useState("+91");
  const [waLoading, setWaLoading] = useState(false);
  const [waResult, setWaResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendWhatsApp = async () => {
    if (!data || !waPhoneNumber) return;
    setWaLoading(true);
    setWaResult(null);
    try {
      const res = await fetch(`/api/borrowers/${data.borrower.id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: waPhoneNumber,
          borrowerName: data.borrower.full_name,
          score: data.score,
          bucket: data.bucket,
          reasons: data.risk_reasons,
          status: Number(data.score) >= 650 ? "DECLINED" : Number(data.score) >= 450 ? "MANUAL_REVIEW" : "APPROVED",
        }),
      });
      const json = await res.json();
      if (json.data?.success) {
        setWaResult({
          success: true,
          message: json.data.simulated
            ? "Notification logged in simulation mode (ready for live Meta Cloud API keys)."
            : "WhatsApp message successfully delivered to recipient!",
        });
      } else {
        setWaResult({ success: false, message: json.data?.error || "Failed to dispatch WhatsApp message" });
      }
    } catch (e: any) {
      setWaResult({ success: false, message: e.message || "Network error" });
    } finally {
      setWaLoading(false);
    }
  };


  useEffect(() => {
    params.then((p) => {
      // 1. Fetch primary score & borrower profile
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

      // 2. Fetch alternative credit payment history
      fetch(`/api/borrowers/${p.id}/alternative-credit`)
        .then((r) => r.json())
        .then((x) => {
          if (x.data) setAltCredit(x.data);
        })
        .catch(console.warn);

      // 3. Fetch scoring history audit trail
      fetch(`/api/borrowers/${p.id}/scoring-history`)
        .then((r) => r.json())
        .then((x) => {
          if (x.data) setScoringHistory(x.data);
        })
        .catch(console.warn);
    });
  }, [params]);

  // Dynamic What-If Risk Recalculation (Local Elasticity Baseline)
  const baselineScore = data ? Number(data.score) : 0.5;
  const originalAmount = data?.borrower ? Number(data.borrower.loan_amount || 1) : 1;
  const originalTenure = data?.borrower ? Number(data.borrower.tenure_months || 1) : 1;
  const originalIncome = data?.borrower ? Number(data.borrower.monthly_income || 1) : 1;

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

  // Live AWS Serverless Inference Rescore
  const handleLiveRescore = async () => {
    if (!data?.borrower) return;
    setLiveRescoreLoading(true);
    try {
      const res = await fetch(`/api/borrowers/${data.borrower.id}/rescore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "what_if",
          overrides: {
            loan_amount: simLoanAmount,
            tenure_months: simTenure,
            monthly_income: simIncome,
          },
        }),
      });
      const resJson = await res.json();
      if (resJson.data) {
        setData((prev: any) => ({
          ...prev,
          score: resJson.data.score,
          bucket: resJson.data.bucket?.toLowerCase() || prev.bucket,
          model_version: resJson.data.model_version || prev.model_version,
          risk_reasons: resJson.data.risk_reasons || prev.risk_reasons,
          shap_values: resJson.data.shap_values || prev.shap_values,
          lime_explanations: resJson.data.lime_explanations || prev.lime_explanations,
        }));

        // Refresh audit trail
        const hRes = await fetch(`/api/borrowers/${data.borrower.id}/scoring-history`);
        const hJson = await hRes.json();
        if (hJson.data) setScoringHistory(hJson.data);
      }
    } catch (e) {
      console.error("Live rescore failed:", e);
    } finally {
      setLiveRescoreLoading(false);
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setWaResult(null);
                  setShowWhatsAppModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                <MessageSquare className="size-4" />
                Notify via WhatsApp
              </button>
              <button
                onClick={fetchCreditMemo}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3.5 py-2 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/20"
              >
                <Sparkles className="size-4" />
                Generate AI Credit Memo (AWS Bedrock)
              </button>
              <button
                onClick={() => setShowNotice(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <FileText className="size-4" />
                Generate Adverse Action Notice (ECOA/CFPB)
              </button>
            </div>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Institutional Credit File · SR 11-7 Governed
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                  {data.borrower?.full_name}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  ID: <span className="font-mono font-medium text-foreground">{data.borrower?.external_id}</span> · {data.borrower?.email} · {data.borrower?.geography}
                </p>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  data.bucket === 'critical' ? 'bg-destructive/15 text-destructive' :
                  data.bucket === 'high' ? 'bg-orange-500/15 text-orange-500' :
                  data.bucket === 'medium' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {data.bucket} Risk · PD {data.score}
                </span>

                {data.borrower?.alternative_credit_score && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Activity className="size-3.5" />
                    Alt Credit: {data.borrower.alternative_credit_score}
                  </span>
                )}

                {data.borrower?.collateral_type && data.borrower.collateral_type !== 'none' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Landmark className="size-3.5" />
                    Secured ({data.borrower.collateral_type})
                  </span>
                )}

                {data.borrower?.income_verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3.5" />
                    Verified Income
                  </span>
                )}
              </div>
            </div>

            {/* Comprehensive Multi-Factor Underwriting Dossier */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Block 1: Loan & Debt Obligations */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                  <CreditCard className="size-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Credit & Debt Obligations
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Loan Purpose" value={data.borrower?.loan_type} />
                  <Field label="Principal Requested" value={`$${Number(data.borrower?.loan_amount || 0).toLocaleString()}`} />
                  <Field label="Outstanding Balance" value={`$${Number(data.borrower?.outstanding_balance || 0).toLocaleString()}`} />
                  <Field label="Repayment Tenure" value={`${data.borrower?.tenure_months || 0} months`} />
                  <Field label="Credit Card Debt" value={`$${Number(data.borrower?.existing_credit_card_debt || 0).toLocaleString()}`} />
                  <Field label="Auto / Personal Loans" value={`$${(Number(data.borrower?.existing_auto_loans || 0) + Number(data.borrower?.existing_personal_loans || 0)).toLocaleString()}`} />
                </div>
              </div>

              {/* Block 2: Assets & Collateral Protection */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Landmark className="size-4 text-purple-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Assets & Collateral Cushion
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Collateral Pledged" value={data.borrower?.collateral_type !== 'none' ? data.borrower?.collateral_type : 'Unsecured'} />
                  <Field label="Collateral Value" value={data.borrower?.collateral_value ? `$${Number(data.borrower.collateral_value).toLocaleString()}` : '$0'} />
                  <Field label="Real Estate Assets" value={`$${Number(data.borrower?.real_estate_value || 0).toLocaleString()}`} />
                  <Field label="Liquid Cash Reserves" value={`$${Number(data.borrower?.liquid_savings || 0).toLocaleString()}`} />
                  <Field label="Investments Portfolio" value={`$${Number(data.borrower?.investment_portfolio_value || 0).toLocaleString()}`} />
                  <Field
                    label="Collateral Coverage"
                    value={
                      data.borrower?.loan_amount && data.borrower?.collateral_value
                        ? `${Math.round((Number(data.borrower.collateral_value) / Number(data.borrower.loan_amount)) * 100)}%`
                        : '0%'
                    }
                  />
                </div>
              </div>

              {/* Block 3: Demographic & Household Profile */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Users className="size-4 text-blue-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Demographic Profile
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Age" value={data.borrower?.age ? `${data.borrower.age} years` : '—'} />
                  <Field label="Marital Status" value={data.borrower?.marital_status ? data.borrower.marital_status[0].toUpperCase() + data.borrower.marital_status.slice(1) : '—'} />
                  <Field label="Family Dependents" value={data.borrower?.num_dependents != null ? String(data.borrower.num_dependents) : '0'} />
                  <Field
                    label="Health Profile"
                    value={
                      data.borrower?.health_status === 'healthy'
                        ? 'Healthy'
                        : data.borrower?.health_status === 'chronic_condition'
                        ? 'Chronic Condition'
                        : data.borrower?.health_status === 'disability'
                        ? 'Disability'
                        : 'Standard'
                    }
                  />
                  <Field label="Geography" value={data.borrower?.geography} />
                  <Field label="Disability Flag" value={data.borrower?.disability_flag ? 'Yes' : 'No'} />
                </div>
              </div>

              {/* Block 4: Income & Employment Stability */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b pb-3">
                  <HeartPulse className="size-4 text-emerald-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Income & Career Stability
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Income" value={`$${Number(data.borrower?.monthly_income || 0).toLocaleString()}`} />
                  <Field label="Income Source" value={data.borrower?.income_source ? data.borrower.income_source.replace('_', ' ') : 'Wages'} />
                  <Field label="Employment Status" value={data.borrower?.employment_status} />
                  <Field label="Job Tenure" value={data.borrower?.months_at_current_job ? `${data.borrower.months_at_current_job} months` : '—'} />
                  <Field label="Income Verified" value={data.borrower?.income_verified ? 'Verified (IRS/W2)' : 'Unverified'} />
                  <Field label="Income Stability Score" value={data.borrower?.income_consistency_score ? `${Math.round(data.borrower.income_consistency_score * 100)}/100` : '75/100'} />
                </div>
              </div>
            </div>

            {/* Score & SHAP Attribution Section */}
            <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
              {/* Score card */}
              <section className="rounded-xl border bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Calibrated Credit Risk Score</p>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="font-mono text-6xl font-bold tracking-tight">{data.score}</span>
                    <span className="mb-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">
                      {data.bucket} Risk
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Estimated Probability of Default: <strong>{(Number(data.score) / 10).toFixed(1)}%</strong>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Scored By: <span className="font-mono text-foreground">{data.model_version || 'v2.0.0-aws-lambda'}</span>
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Loss Given Default (LGD Baseline):</span>
                    <span className="font-mono font-medium text-foreground">
                      {data.borrower?.collateral_value > data.borrower?.loan_amount * 0.8 ? '25%' : '45%'}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Exposure at Default (EAD):</span>
                    <span className="font-mono font-medium text-foreground">
                      ${Number(data.borrower?.outstanding_balance || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Expected Loss (EL = PD × EAD × LGD):</span>
                    <span className="font-mono font-semibold text-foreground">
                      ${Math.round((Number(data.score) / 1000) * Number(data.borrower?.outstanding_balance || 0) * (data.borrower?.collateral_value > data.borrower?.loan_amount * 0.8 ? 0.25 : 0.45)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </section>

              {/* SHAP Factors */}
              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Why this score? (SHAP Attributions)</h2>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  {(data.risk_reasons || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contributing factors recorded.</p>
                  ) : (
                    data.risk_reasons.map((r: any) => (
                      <div key={r.rank}>
                        <div className="flex justify-between gap-4 text-xs">
                          <span className="font-medium text-foreground">{r.reason}</span>
                          <span className="font-mono text-muted-foreground">
                            {r.impact > 0 ? "+" : ""}
                            {r.impact}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-secondary">
                          <div
                            className={`h-1.5 rounded-full ${r.impact > 0 ? "bg-destructive" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, Math.abs(r.impact) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            {/* LIME Multi-Factor Decision Explainability Cards */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    LIME Multi-Factor Decision Interpretability
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Local interpretable model-agnostic explanations across credit, demographic, and collateral dimensions.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  FCRA & ECOA Fair Lending
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {generateLimeCards(data.lime_explanations, data.shap_values).map((card, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 text-xs transition-colors ${
                      card.direction === 'increases'
                        ? 'border-destructive/20 bg-destructive/5'
                        : 'border-emerald-500/20 bg-emerald-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{card.title}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
                          card.direction === 'increases'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {card.impactBadge}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground leading-relaxed">
                      {card.explanation}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">{card.category} signal</span>
                      <span className="font-mono font-medium text-foreground">Magnitude: {card.magnitude}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Alternative Credit Cashflow Signals */}
            {altCredit && altCredit.length > 0 && (
              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-blue-500" />
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Alternative Credit & Utility Cashflow Signals
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Real-time telecom, rental, and utility payment telemetry augmenting traditional FICO records.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Alt Score: {data.borrower?.alternative_credit_score || '720'}
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Provider / Aggregator</th>
                        <th className="px-4 py-2.5 font-medium">Payment Stream</th>
                        <th className="px-4 py-2.5 font-medium">Track Record</th>
                        <th className="px-4 py-2.5 font-medium">On-Time Payment Rate</th>
                        <th className="px-4 py-2.5 font-medium">Average Monthly Bill</th>
                        <th className="px-4 py-2.5 font-medium">Last Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {altCredit.map((ac) => (
                        <tr key={ac.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium text-foreground">{ac.provider_name}</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">{ac.data_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 font-mono">{ac.months_of_history} months</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3.5" />
                              {(Number(ac.on_time_payment_rate) * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">${Number(ac.average_monthly_amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(ac.last_updated).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* MassMutual Underwriter "What-If" Scenario Simulator with Live AWS Rescore */}
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
                        Live AWS Lambda Rescoring
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Test loan restructuring parameters to find viable approval terms and trigger instant serverless inference.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={resetSimulation}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset
                  </button>
                  <button
                    onClick={handleLiveRescore}
                    disabled={liveRescoreLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {liveRescoreLoading ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Invoking AWS Inference...
                      </>
                    ) : (
                      <>
                        <Zap className="size-3.5" />
                        Run Live Serverless Rescore (AWS)
                      </>
                    )}
                  </button>
                </div>
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

            {/* Continuous Learning & Scoring History Audit Trail */}
            {scoringHistory && scoringHistory.length > 0 && (
              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <History className="size-5 text-primary" />
                    <div>
                      <h2 className="text-base font-semibold text-foreground">
                        Scoring History & Continuous Learning Audit Trail
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Chronological record of model invocations, what-if scenario simulations, and regulatory snapshots.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {scoringHistory.length} Recorded Snapshots
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 uppercase tracking-wider text-[10px] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Timestamp</th>
                        <th className="px-4 py-2.5 font-medium">Score / PD</th>
                        <th className="px-4 py-2.5 font-medium">Risk Bucket</th>
                        <th className="px-4 py-2.5 font-medium">Scoring Method</th>
                        <th className="px-4 py-2.5 font-medium">Model Version</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scoringHistory.map((sh) => (
                        <tr key={sh.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {new Date(sh.scored_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">{sh.score}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize">
                              {sh.bucket}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize font-mono text-[11px] text-muted-foreground">
                            {sh.scoring_method || 'batch'}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            {sh.model_version}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
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

        {/* AWS Bedrock GenAI Credit Memo Modal */}
        {showMemoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-purple-400" />
                  <h3 className="font-semibold text-lg">
                    Credit Underwriting Memorandum
                  </h3>
                </div>
                <button
                  onClick={() => setShowMemoModal(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4">
                {memoLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="size-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                    <p className="mt-4 text-sm font-medium">Invoking Amazon Bedrock GenAI Runtime...</p>
                    <p className="text-xs text-muted-foreground">Synthesizing XGBoost weights, SHAP vectors, and leverage ratios</p>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap rounded-lg bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                    {creditMemo}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between border-t pt-4">
                <span className="text-[11px] text-muted-foreground flex items-center">
                  Engine: AWS Bedrock Runtime · Model: Claude 3.5 Haiku
                </span>
                <button
                  onClick={() => setShowMemoModal(false)}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white hover:bg-purple-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Notification Dispatch Modal */}
        {showWhatsAppModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5 text-emerald-400" />
                  <h3 className="font-semibold text-base">
                    Dispatch WhatsApp Notification
                  </h3>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sends an automated credit decision update to the borrower or co-signer via Meta WhatsApp Business Cloud API.
                </p>

                <div>
                  <label className="text-xs font-medium text-foreground">
                    Recipient Mobile Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    value={waPhoneNumber}
                    onChange={(e) => setWaPhoneNumber(e.target.value)}
                    placeholder="+919876543210 or +1234567890"
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="rounded-lg border border-muted bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground">Message Payload Preview:</p>
                  <p className="text-muted-foreground">Borrower: {data?.borrower?.full_name}</p>
                  <p className="text-muted-foreground">Score: {data?.score}/1000 ({data?.bucket} RISK)</p>
                  <p className="text-muted-foreground">
                    Status: {Number(data?.score) >= 650 ? "DECLINED" : Number(data?.score) >= 450 ? "MANUAL_REVIEW" : "APPROVED"}
                  </p>
                </div>

                {waResult && (
                  <div
                    className={`rounded-lg p-3 text-xs ${
                      waResult.success
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {waResult.message}
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t pt-4">
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={waLoading || !waPhoneNumber}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-opacity hover:bg-emerald-700 disabled:opacity-50"
                >
                  {waLoading ? (
                    <>
                      <div className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="size-3.5" />
                      Send WhatsApp Alert
                    </>
                  )}
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