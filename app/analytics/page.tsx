"use client";
import { useEffect, useState } from "react";
import { Shell } from "@/components/dashboard/shell";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export default function Analytics() {
  const [data, setData] = useState<any>();
  useEffect(() => {
    let fetchData = fetch("/api/analytics/portfolio")
      .then((r) => r.json())
      .then((x) => setData(x.data));
  }, []);
  console.log(data);
  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Portfolio intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Understand how risk concentrates across the book.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            ["Risk by loan type", "byLoanType"],
            ["Risk by geography", "byGeography"],
            ["Risk by tenure", "byTenure"],
          ].map(([title, key]) => (
            <section key={key} className="rounded-xl border bg-card p-5">
              <h2 className="font-semibold">{title}</h2>
              <div className="mt-6 h-56">
                {data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data[key]}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip cursor={{ fill: "var(--muted)" }} />
                      <Bar
                        dataKey="score"
                        fill="var(--primary)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Loading chart…
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}
