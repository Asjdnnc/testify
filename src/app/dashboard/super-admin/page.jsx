"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  School, CreditCard, CheckCircle2, AlertTriangle, Clock,
  XCircle, TrendingUp, ArrowRight, Loader2, Users,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, href, accent }) {
  const inner = (
    <div className={`bg-card border rounded-2xl p-5 space-y-3 transition-all group ${href ? "hover:border-primary/30 cursor-pointer" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent || "bg-primary/10"}`}>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value ?? "—"}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {href && (
        <div className="flex items-center gap-1 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View all <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function SuperAdminHome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { if (d.success) setStats(d.stats); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Platform overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">Every college on Testify, their subscriptions and plans.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={School} label="Total Colleges" value={stats?.collegeCount ?? 0}
            sub="Active institutions" href="/dashboard/super-admin/colleges" />
          <StatCard icon={Clock} label="On Trial" value={stats?.trialCount ?? 0}
            sub="Free trial accounts" href="/dashboard/super-admin/colleges" />
          <StatCard icon={CheckCircle2} label="Active Paid" value={stats?.activeCount ?? 0}
            sub="Paying subscribers" href="/dashboard/super-admin/colleges" />
          <StatCard icon={AlertTriangle} label="Needs Attention" value={stats?.suspendedCount ?? 0}
            sub="Suspended or expired" href="/dashboard/super-admin/colleges" />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Manage Colleges",
              desc: "View, suspend, cancel or restore institution accounts",
              icon: School,
              href: "/dashboard/super-admin/colleges",
            },
            {
              label: "Manage Plans",
              desc: "Edit pricing, resource limits and features for each plan",
              icon: CreditCard,
              href: "/dashboard/super-admin/plans",
            },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="bg-card border hover:border-primary/30 hover:bg-primary/5 rounded-xl p-5 flex items-center gap-4 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-foreground font-semibold text-sm">{item.label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5 truncate">{item.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Status breakdown */}
      {stats && (
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Subscription Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: "Active (Paid)", value: stats.activeCount, color: "bg-success", total: stats.collegeCount },
              { label: "Trial", value: stats.trialCount, color: "bg-warning", total: stats.collegeCount },
              { label: "Suspended / Expired", value: stats.suspendedCount, color: "bg-destructive", total: stats.collegeCount },
            ].map((row) => {
              const pct = stats.collegeCount > 0 ? Math.round((row.value / stats.collegeCount) * 100) : 0;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-foreground">{row.value} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${row.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
