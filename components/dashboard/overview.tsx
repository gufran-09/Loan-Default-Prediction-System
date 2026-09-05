'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight, AlertTriangle, ShieldCheck, Users, TrendingUp } from 'lucide-react'

type Row = { id: string; external_id: string; full_name: string; loan_type: string; geography: string; outstanding_balance: number; risk_scores: { score: number; bucket: string } | { score: number; bucket: string }[] }
const scoreOf = (row: Row) => Array.isArray(row.risk_scores) ? row.risk_scores[0] : row.risk_scores
const badge = (bucket: string) => `rounded-full px-2.5 py-1 text-xs font-medium ${bucket === 'critical' ? 'bg-destructive/10 text-destructive' : bucket === 'high' ? 'bg-orange-500/10 text-orange-700' : bucket === 'medium' ? 'bg-yellow-500/15 text-yellow-700' : 'bg-emerald-500/10 text-emerald-700'}`

export function Overview() {
  const [rows, setRows] = useState<Row[]>([])
  const [openAlerts, setOpenAlerts] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/borrowers?pageSize=5').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
    ])
      .then(([borrowersRes, alertsRes]) => {
        if (borrowersRes.error) throw new Error(borrowersRes.error.message)
        if (alertsRes.error) throw new Error(alertsRes.error.message)
        setRows(borrowersRes.data || [])
        const alerts = alertsRes.data || []
        setOpenAlerts(alerts.filter((a: any) => a.status === 'open').length)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const avg = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + Number(scoreOf(r)?.score || 0), 0) / rows.length)
    : 0

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Portfolio health</h1>
          <p className="mt-2 text-sm text-muted-foreground">A clear view of exposure, concentration, and emerging borrower risk.</p>
        </div>
        <Link href="/borrowers" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Review borrowers<ArrowUpRight className="size-4" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Couldn't load overview: {error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi label="Borrowers monitored" value={loading ? '—' : String(rows.length)} detail="Across active portfolio" icon={Users} />
            <Kpi label="Average risk score" value={loading ? '—' : `${avg}/100`} detail="Lower is healthier" icon={TrendingUp} />
            <Kpi label="Open alerts" value={loading ? '—' : String(openAlerts ?? 0)} detail={loading ? '' : (openAlerts ?? 0) > 0 ? 'Requires review' : 'All clear'} icon={AlertTriangle} />
          </div>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">Priority borrowers</h2>
                <p className="text-sm text-muted-foreground">Highest signal in the current monitoring window.</p>
              </div>
              <Link href="/borrowers" className="text-sm font-medium text-primary">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Borrower</th>
                    <th className="px-5 py-3 font-medium">Loan type</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}><td className="px-5 py-4" colSpan={4}><div className="h-4 w-full animate-pulse rounded bg-muted" /></td></tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr><td className="px-5 py-6 text-center text-sm text-muted-foreground" colSpan={4}>No borrowers match filters.</td></tr>
                  ) : rows.map(r => {
                    const score = scoreOf(r)
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-5 py-4">
                          <Link href={`/borrowers/${r.id}`} className="font-medium hover:underline">{r.full_name}</Link>
                          <p className="font-mono text-xs text-muted-foreground">{r.external_id}</p>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{r.loan_type}</td>
                        <td className="px-5 py-4 text-muted-foreground">{r.geography}</td>
                        <td className="px-5 py-4"><span className={badge(score?.bucket || 'low')}>{score?.bucket || 'pending'} · {score?.score || '—'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Production Model Active (xgb-v1.0.0)</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Serving calibrated Probability of Default (PD) scoring with SHAP local explainability. Decoupled scoring seam integrated with AWS S3 model registry and audit telemetry.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: any }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}