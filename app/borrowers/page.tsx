'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Shell } from '@/components/dashboard/shell'
import { Search, ArrowUpRight } from 'lucide-react'

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
    bucket === 'high' ? 'bg-orange-500/10 text-orange-700' :
    bucket === 'medium' ? 'bg-yellow-500/15 text-yellow-700' :
    bucket === 'low' ? 'bg-emerald-500/10 text-emerald-700' :
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

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Portfolio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Borrowers</h1>
          <p className="mt-2 text-sm text-muted-foreground">Search and triage the monitored borrower book.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-11 max-w-md flex-1 items-center gap-3 rounded-lg border bg-card px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or borrower ID"
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
                  <th className="px-5 py-3 font-medium">Risk</th>
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
                    Couldn't load borrowers: {error}
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
                      <td className="px-5 py-4">${Number(r.outstanding_balance).toLocaleString()}</td>
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
      </div>
    </Shell>
  )
}