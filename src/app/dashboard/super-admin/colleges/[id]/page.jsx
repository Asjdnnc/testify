"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  School, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Clock,
  RefreshCw, Loader2, CreditCard, Users, Calendar, ShieldAlert,
  ShieldOff, GraduationCap, BookOpen,
} from "lucide-react";

const STATUS_CONFIG = {
  TRIAL:        { label: "Free Trial",    icon: Clock,          badge: "bg-amber-500/15 text-warning-foreground border border-warning/40" },
  TRIAL_EXPIRED:{ label: "Trial Expired", icon: AlertTriangle,  badge: "bg-red-500/15 text-destructive border border-destructive/40" },
  ACTIVE:       { label: "Active",        icon: CheckCircle2,   badge: "bg-emerald-500/15 text-success-foreground border border-success/40" },
  SUSPENDED:    { label: "Suspended",     icon: AlertTriangle,  badge: "bg-orange-500/15 text-orange-500 border border-orange-500/30" },
  CANCELLED:    { label: "Cancelled",     icon: XCircle,        badge: "bg-red-500/15 text-destructive border border-destructive/40" },
};

export default function CollegeDetailPage() {
  const { id } = useParams();
  const [college, setCollege] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`/api/org/college/${id}`).then((r) => r.json()),
        fetch(`/api/payments/history?collegeId=${id}`).then((r) => r.json()),
      ]);
      if (cRes.success) setCollege(cRes.college);
      else throw new Error(cRes.message);
      if (pRes.success) setPayments(pRes.payments || []);
    } catch (err) {
      setError(err.message || "Failed to load college data");
    } finally {
      setLoading(false);
    }
  }

  async function doAction(action) {
    setActionLoading(action);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/super-admin/colleges/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setSuccessMsg(
        action === "SUSPEND"
          ? "College has been suspended. Their admin will see an access restriction message."
          : "College restored to TRIAL_EXPIRED status. Admin can now resubscribe."
      );
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !college) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-destructive">{error}</p>
        <Link href="/dashboard/super-admin/colleges" className="text-sm text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Colleges
        </Link>
      </div>
    );
  }

  const status = college?.subscriptionStatus;
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.TRIAL;
  const StatusIcon = statusConf.icon;
  const canSuspend = status === "TRIAL" || status === "ACTIVE";
  const canRestore = status === "SUSPENDED" || status === "CANCELLED" || status === "TRIAL_EXPIRED" || college?.deletedAt;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back nav */}
      <Link href="/dashboard/super-admin/colleges" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Colleges
      </Link>

      {/* College header card */}
      <div className="bg-card border rounded-2xl p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <School className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{college?.name}</h1>
            {college?.address && <p className="text-muted-foreground text-sm mt-0.5">{college.address}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              Plan: <span className="font-semibold text-foreground">{college?.planType}</span>
            </p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${statusConf.badge}`}>
          <StatusIcon className="w-3 h-3" /> {statusConf.label}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-success/40 rounded-xl p-4 text-success-foreground dark:text-success-foreground text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Soft-delete warning */}
      {college?.deletedAt && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-destructive mt-0.5" />
          <div>
            <h3 className="text-destructive font-semibold">College is soft-deleted</h3>
            <p className="text-destructive/70 text-sm mt-1">
              Deleted on {new Date(college.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
              {college.deletionReason && ` Reason: ${college.deletionReason}`}
            </p>
          </div>
        </div>
      )}

      {/* Stats grid — plan, trial/period dates, teacher count, student count */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Plan", value: college?.planType || "—", icon: CreditCard },
          { label: "Admin Users", value: college?.users?.length ?? 0, icon: Users },
          { label: "Teachers", value: college?.teacherCount ?? 0, icon: GraduationCap },
          { label: "Students", value: college?.studentCount ?? 0, icon: BookOpen },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-4 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <s.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="text-foreground font-semibold text-sm">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription dates */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            label: "Trial Ends",
            value: college?.trialEndsAt
              ? new Date(college.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
              : "—",
            icon: Clock,
          },
          {
            label: "Subscription Period End",
            value: college?.currentPeriodEnd
              ? new Date(college.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
              : "—",
            icon: Calendar,
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="text-foreground font-medium text-sm">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Super Admin Actions — Suspend and Restore only */}
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Super Admin Actions</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          {canSuspend && (
            <button
              onClick={() => doAction("SUSPEND")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 text-sm font-medium transition-all disabled:opacity-50"
            >
              {actionLoading === "SUSPEND" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldOff className="w-4 h-4" />
              )}
              Suspend College
            </button>
          )}

          {canRestore && (
            <button
              onClick={() => doAction("RESTORE")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-success/40 text-success-foreground dark:text-success-foreground hover:bg-emerald-500/10 text-sm font-medium transition-all disabled:opacity-50"
            >
              {actionLoading === "RESTORE" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Restore Access
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-1">
          <strong>Suspend</strong> — temporarily revokes platform access while preserving all data. 
          Use when an institution violates terms. &nbsp;·&nbsp;
          <strong>Restore</strong> — re-enables access; the college admin will need to resubscribe to a paid plan.
          Cancellations are initiated by the college themselves.
        </p>
      </div>

      {/* Admin users list */}
      {college?.users?.length > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Admin Users</h2>
          </div>
          <div className="divide-y divide-border">
            {college.users.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium text-sm">{u.name}</p>
                  <p className="text-muted-foreground text-xs">{u.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Payment History</h2>
          </div>
          <div className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-foreground text-sm font-medium">{p.planType}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-semibold text-sm">
                    ₹{(p.amountInPaise / 100).toFixed(0)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === "SUCCESS" ? "bg-emerald-500/15 text-success-foreground" :
                    p.status === "FAILED" ? "bg-red-500/15 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length === 0 && (
        <div className="bg-card border rounded-xl p-5 text-center">
          <CreditCard className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No payments recorded yet</p>
        </div>
      )}
    </div>
  );
}
