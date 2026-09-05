"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/dashboard/shell";
import { Bell, ArrowUpRight } from "lucide-react";

const severityStyles = (severity: string) => {
  switch (severity) {
    case "critical":
      return { badge: "bg-destructive/10 text-destructive", icon: "bg-destructive/10 text-destructive" };
    case "high":
      return { badge: "bg-orange-500/10 text-orange-700", icon: "bg-orange-500/10 text-orange-700" };
    case "medium":
      return { badge: "bg-yellow-500/15 text-yellow-700", icon: "bg-yellow-500/15 text-yellow-700" };
    default:
      return { badge: "bg-emerald-500/10 text-emerald-700", icon: "bg-emerald-500/10 text-emerald-700" };
  }
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((x) => {
        if (x.error) throw new Error(x.error.message);
        const sorted = (x.data || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAlerts(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Monitoring
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Alerts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signals that need a risk officer&apos;s attention.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Couldn't load alerts: {error}
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No active alerts.
            </div>
          ) : (
            alerts.map((a) => {
              const styles = severityStyles(a.severity);
              return (
                <article
                  key={a.id}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex gap-4">
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
                      <Bell className="size-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{a.title}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles.badge}`}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {a.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {a.borrowers?.full_name} ·{" "}
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/borrowers/${a.borrower_id}`}
                    className="flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    Review
                    <ArrowUpRight className="size-4" />
                  </Link>
                </article>
              );
            })
          )}
        </div>
      </div>
    </Shell>
  );
}