"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  School, MapPin, CheckCircle2, AlertTriangle, XCircle, Clock,
  Filter, Search, Loader2, ArrowLeft, ChevronRight,
  ShieldOff, RefreshCw, Trash2,
} from "lucide-react";

const STATUS_CONFIG = {
  TRIAL:        { label: "Trial",     icon: Clock,          cls: "bg-amber-500/15 text-amber-500 border-amber-500/20" },
  TRIAL_EXPIRED:{ label: "Expired",   icon: AlertTriangle,  cls: "bg-red-500/15 text-red-500 border-red-500/20" },
  ACTIVE:       { label: "Active",    icon: CheckCircle2,   cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" },
  SUSPENDED:    { label: "Suspended", icon: AlertTriangle,  cls: "bg-orange-500/15 text-orange-500 border-orange-500/20" },
  CANCELLED:    { label: "Cancelled", icon: XCircle,        cls: "bg-red-500/15 text-red-500 border-red-500/20" },
};

const FILTERS = [
  { value: "ALL", label: "All" },
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIAL_EXPIRED", label: "Expired" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CANCELLED", label: "Cancelled" },
];

function StatusBadge({ status }) {
  const conf = STATUS_CONFIG[status] || STATUS_CONFIG.TRIAL;
  const Icon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${conf.cls}`}>
      <Icon className="w-3 h-3" /> {conf.label}
    </span>
  );
}

function QuickActionButton({ label, icon: Icon, onClick, variant = "default", loading }) {
  const styles = {
    default: "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
    danger:  "border-red-500/30 text-red-500 hover:bg-red-500/10",
    warning: "border-orange-500/30 text-orange-500 hover:bg-orange-500/10",
    success: "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-40 ${styles[variant]}`}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}

export default function CollegesPage() {
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // collegeId being acted on
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => { loadColleges(); }, []);

  async function loadColleges() {
    setLoading(true);
    try {
      const res = await fetch("/api/org/college").then((r) => r.json());
      if (res.success) setColleges(res.colleges);
    } finally {
      setLoading(false);
    }
  }

  async function doAction(collegeId, action, extra = {}) {
    setActionLoading(collegeId);
    setError("");
    try {
      const res = await fetch(`/api/super-admin/colleges/${collegeId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      showToast(`Action "${action}" applied successfully`);
      await loadColleges();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const filtered = useMemo(() => {
    return colleges.filter((c) => {
      const matchStatus = statusFilter === "ALL" || c.subscriptionStatus === statusFilter;
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [colleges, statusFilter, search]);

  const counts = useMemo(() => {
    return colleges.reduce((acc, c) => {
      acc[c.subscriptionStatus] = (acc[c.subscriptionStatus] || 0) + 1;
      return acc;
    }, {});
  }, [colleges]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/super-admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Overview
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <School className="w-6 h-6 text-primary" /> College Management
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {colleges.length} institution{colleges.length !== 1 ? "s" : ""} registered on the platform
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError("")} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search by college name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {opt.label}
              {opt.value !== "ALL" && counts[opt.value] ? (
                <span className="ml-1 opacity-70">({counts[opt.value]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Colleges list */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <School className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">
              {search || statusFilter !== "ALL" ? "No colleges match your filters." : "No colleges registered yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((college) => {
              const isActing = actionLoading === college.id;
              const status = college.subscriptionStatus;
              const canSuspend = status === "TRIAL" || status === "ACTIVE";
              const canRestore = status === "SUSPENDED" || status === "CANCELLED" || status === "TRIAL_EXPIRED" || college.deletedAt;

              return (
                <div
                  key={college.id}
                  className={`px-5 py-4 flex items-center gap-4 hover:bg-accent/50 transition-colors ${college.deletedAt ? "opacity-60" : ""}`}
                >
                  {/* College info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-foreground text-sm truncate">{college.name}</p>
                      {college.deletedAt && (
                        <span className="text-xs text-destructive border border-destructive/30 rounded-full px-2 py-0.5">Deleted</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {college.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {college.address}
                        </span>
                      )}
                      <span className="font-mono">{college.planType}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={status} />

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canSuspend && (
                      <QuickActionButton
                        label="Suspend" icon={ShieldOff} variant="warning"
                        loading={isActing}
                        onClick={() => doAction(college.id, "SUSPEND")}
                      />
                    )}
                    {canRestore && (
                      <QuickActionButton
                        label="Restore" icon={RefreshCw} variant="success"
                        loading={isActing}
                        onClick={() => doAction(college.id, "RESTORE")}
                      />
                    )}

                    <QuickActionButton
                      label="Delete" icon={Trash2} variant="danger"
                      loading={isActing}
                      onClick={() => {
                        if (confirm("Are you sure you want to PERMANENTLY delete this college and ALL its data (users, exams, questions, etc.)? This action cannot be undone.")) {
                          doAction(college.id, "DELETE");
                        }
                      }}
                    />

                    {/* Detail link */}
                    <Link
                      href={`/dashboard/super-admin/colleges/${college.id}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-accent transition-all"
                    >
                      Details <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
