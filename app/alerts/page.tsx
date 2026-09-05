"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/dashboard/shell";
import { Bell, ArrowUpRight, CheckCircle, Clock, AlertTriangle } from "lucide-react";

const severityStyles = (severity: string) => {
  switch (severity) {
    case "critical":
      return { badge: "bg-destructive/10 text-destructive", icon: "bg-destructive/10 text-destructive" };
    case "high":
      return { badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400", icon: "bg-orange-500/10 text-orange-700 dark:text-orange-400" };
    case "medium":
      return { badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400", icon: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" };
    default:
      return { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
  }
};

const statusStyles = (status: string) => {
  switch (status) {
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "acknowledged":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  async function updateStatus(alertId: string, newStatus: "acknowledged" | "resolved") {
    setActionLoading(alertId);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || "Failed to update alert");
      }
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filterStatus === "all") return true;
    return (a.status || "open") === filterStatus;
  });

  const openCount = alerts.filter((a) => (a.status || "open") === "open").length;
  const acknowledgedCount = alerts.filter((a) => a.status === "acknowledged").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Risk Monitoring & Triage
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Alerts</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              High-risk borrower flags requiring active credit officer triage.
            </p>
          </div>

          <div className="flex gap-2 rounded-lg border bg-card p-1 text-xs font-medium">
            <button
              onClick={() => setFilterStatus("all")}
              className={`rounded-md px-3 py-1.5 transition-colors ${filterStatus === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilterStatus("open")}
              className={`rounded-md px-3 py-1.5 transition-colors ${filterStatus === "open" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Open ({openCount})
            </button>
            <button
              onClick={() => setFilterStatus("acknowledged")}
              className={`rounded-md px-3 py-1.5 transition-colors ${filterStatus === "acknowledged" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Acknowledged ({acknowledgedCount})
            </button>
            <button
              onClick={() => setFilterStatus("resolved")}
              className={`rounded-md px-3 py-1.5 transition-colors ${filterStatus === "resolved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Couldn&apos;t load alerts: {error}
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
              <CheckCircle className="mx-auto size-8 text-muted-foreground/60 mb-3" />
              No alerts found under the &quot;{filterStatus}&quot; filter.
            </div>
          ) : (
            filteredAlerts.map((a) => {
              const styles = severityStyles(a.severity);
              const currentStatus = a.status || "open";
              const isUpdating = actionLoading === a.id;

              return (
                <article
                  key={a.id}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex gap-4">
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
                      <Bell className="size-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-foreground">{a.title}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles.badge}`}>
                          {a.severity}
                        </span>
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${statusStyles(currentStatus)}`}>
                          {currentStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {a.description}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Borrower: <span className="font-medium text-foreground">{a.borrowers?.full_name || "Unknown"}</span> ·{" "}
                        Flagged {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:self-center">
                    {currentStatus === "open" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => updateStatus(a.id, "acknowledged")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <Clock className="size-3.5 text-blue-500" />
                        Acknowledge
                      </button>
                    )}

                    {currentStatus !== "resolved" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => updateStatus(a.id, "resolved")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 disabled:opacity-50"
                      >
                        <CheckCircle className="size-3.5" />
                        Resolve
                      </button>
                    )}

                    <Link
                      href={`/borrowers/${a.borrower_id}`}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Profile
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </Shell>
  );
}