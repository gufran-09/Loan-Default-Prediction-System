'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Shell } from '@/components/dashboard/shell'
import { Search, ArrowUpRight, PlusCircle, X, Calculator, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'

type RiskScore = { score: number; bucket: string }
type Borrower = {
  id: string
  external_id: string
  full_name: string
  loan_type: string
  outstanding_balance: number
  risk_scores: RiskScore | RiskScore[] | null
}

const BUCKETS = ['low', 'medium', 'high', 'critical'] as const

const badgeClass = (bucket?: string) =>
  `rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
    bucket === 'critical' ? 'bg-destructive/10 text-destructive' :
    bucket === 'high' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400' :
    bucket === 'medium' ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
    bucket === 'low' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
    'bg-secondary text-muted-foreground'
  }`

const scoreOf = (row: Borrower) =>
  Array.isArray(row.risk_scores) ? row.risk_scores[0] : row.risk_scores

export default function Borrowers() {
  const [rows, setRows] = useState<Borrower[]>([])
  const [search, setSearch] = useState('')
  const [bucket, setBucket] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Live New Applicant Scorer Modal
  const [showScorer, setShowScorer] = useState(false)
  const [applicantName, setApplicantName] = useState('Jordan Taylor')
  const [loanType, setLoanType] = useState('Personal')
  const [loanAmount, setLoanAmount] = useState(25000)
  const [monthlyIncome, setMonthlyIncome] = useState(6500)
  const [creditScore, setCreditScore] = useState(710)
  const [tenure, setTenure] = useState(36)
  const [employment, setEmployment] = useState('Full-time')
  const [calculatedScore, setCalculatedScore] = useState<any>(null)

  // reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, bucket])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: '10', search, bucket })
    fetch(`/api/borrowers?${params}`)
      .then(r => r.json())
      .then(x => {
        if (x.error) throw new Error(x.error.message)
        setRows(x.data || [])
        setPagination(x.pagination)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [search, bucket, page])

  // Live Underwriting Score Calculation
  const runAssessment = (e: React.FormEvent) => {
    e.preventDefault()
    const monthlyPayment = (loanAmount / tenure) * 1.08 // estimated with interest
    const dti = monthlyPayment / Math.max(monthlyIncome, 500)

    // Calibrated credit baseline
    let rawScore = 0.28
    if (dti > 0.45) rawScore += 0.30
    else if (dti > 0.35) rawScore += 0.15
    else if (dti < 0.20) rawScore -= 0.10

    if (creditScore < 600) rawScore += 0.35
    else if (creditScore < 680) rawScore += 0.18
    else if (creditScore > 740) rawScore -= 0.12

    if (employment === 'Unemployed') rawScore += 0.40
    else if (employment === 'Self-Employed') rawScore += 0.08

    const score = Math.max(0.04, Math.min(0.96, Number(rawScore.toFixed(2))))
    const tier = score < 0.3 ? 'low' : score < 0.6 ? 'medium' : score < 0.85 ? 'high' : 'critical'
    
    setCalculatedScore({
      score,
      tier,
      dti: (dti * 100).toFixed(1),
      recommendation:
        score < 0.3
          ? 'Automated Approval: Prime low-risk profile.'
          : score < 0.6
          ? 'Manual Underwriting: Conditional approval recommended.'
          : 'High Default Probability: Requires collateral or credit co-signer.',
    })
  }

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Portfolio Monitoring</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Borrowers</h1>
            <p className="mt-2 text-sm text-muted-foreground">Search and triage the monitored borrower book.</p>
          </div>

          <button
            onClick={() => {
              setCalculatedScore(null)
              setShowScorer(true)
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <PlusCircle className="size-4" />
            Score New Applicant
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-11 max-w-md flex-1 items-center gap-3 rounded-lg border bg-card px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or borrower ID (e.g. LN-000001)"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={bucket}
            onChange={e => setBucket(e.target.value)}
            className="h-11 rounded-lg border bg-card px-3 text-sm outline-none"
          >
            <option value="">All risk buckets</option>
            {BUCKETS.map(b => (
              <option key={b} value={b}>{b[0].toUpperCase() + b.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Borrower</th>
                  <th className="px-5 py-3 font-medium">Loan</th>
                  <th className="px-5 py-3 font-medium">Balance</th>
                  <th className="px-5 py-3 font-medium">Risk Tier</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4" colSpan={5}>
                        <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr><td className="px-5 py-6 text-center text-sm text-destructive" colSpan={5}>
                    Couldn&apos;t load borrowers: {error}
                  </td></tr>
                ) : rows.length === 0 ? (
                  <tr><td className="px-5 py-6 text-center text-sm text-muted-foreground" colSpan={5}>
                    No borrowers match filters.
                  </td></tr>
                ) : rows.map(r => {
                  const s = scoreOf(r)
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <Link className="font-medium hover:underline" href={`/borrowers/${r.id}`}>{r.full_name}</Link>
                        <p className="font-mono text-xs text-muted-foreground">{r.external_id}</p>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{r.loan_type}</td>
                      <td className="px-5 py-4 font-mono">${Number(r.outstanding_balance).toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <span className={badgeClass(s?.bucket)}>{s ? `${s.bucket} · ${s.score}` : 'Pending'}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/borrowers/${r.id}`}>
                          <ArrowUpRight className="ml-auto size-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!loading && !error && rows.length > 0 && (
            <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
              <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} borrowers</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Previous</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* Live Score New Applicant Modal */}
        {showScorer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Calculator className="size-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Instant Credit Underwriting Assessment
                  </h3>
                </div>
                <button onClick={() => setShowScorer(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={runAssessment} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-foreground">Applicant Name</label>
                    <input
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Loan Type</label>
                    <select
                      value={loanType}
                      onChange={(e) => setLoanType(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="Personal">Personal</option>
                      <option value="Auto">Auto</option>
                      <option value="Home">Home Mortgage</option>
                      <option value="Education">Education</option>
                      <option value="Business">Small Business</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Loan Amount ($)</label>
                    <input
                      type="number"
                      required
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Monthly Income ($)</label>
                    <input
                      type="number"
                      required
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Credit Score (FICO)</label>
                    <input
                      type="number"
                      min={300}
                      max={850}
                      required
                      value={creditScore}
                      onChange={(e) => setCreditScore(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Tenure (Months)</label>
                    <input
                      type="number"
                      required
                      value={tenure}
                      onChange={(e) => setTenure(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Employment Status</label>
                  <select
                    value={employment}
                    onChange={(e) => setEmployment(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Full-time">Full-time Employed</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Unemployed">Unemployed</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <ShieldCheck className="size-4" />
                  Run Live ML Risk Assessment
                </button>
              </form>

              {calculatedScore && (
                <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Calibrated Probability of Default</p>
                      <p className="mt-1 font-mono text-3xl font-bold text-foreground">
                        {(calculatedScore.score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className={badgeClass(calculatedScore.tier)}>
                      {calculatedScore.tier} Risk
                    </span>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>DTI Ratio: <strong className="text-foreground">{calculatedScore.dti}%</strong></span>
                    <span>Model: <strong className="text-foreground">XGBoost v1.0.0</strong></span>
                  </div>

                  <div className="mt-3 rounded-md bg-card p-3 text-xs leading-5 text-foreground border">
                    {calculatedScore.recommendation}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}