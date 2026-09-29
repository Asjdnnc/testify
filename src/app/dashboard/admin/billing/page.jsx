"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CreditCard, CheckCircle2, AlertTriangle, XCircle, Users, GraduationCap, ClipboardList,
  Loader2, Check, Minus, Sparkles, Receipt, CalendarClock, ShieldAlert,
} from "lucide-react";
import {
  PageHeader, Panel, StatusBadge, EmptyState, LoadingState, Modal, Field, selectClass, SUBSCRIPTION_TONE,
} from "@/components/ui/saas";

const STATUS_LABEL = {
  TRIAL: "Free trial", TRIAL_EXPIRED: "Trial expired", ACTIVE: "Active", SUSPENDED: "Suspended", CANCELLED: "Cancelled",
};
const PAYMENT_TONE = { SUCCESS: "success", FAILED: "danger", REFUNDED: "info", PENDING: "neutral" };
const PLAN_ORDER = { TRIAL: 0, STARTER: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };
const PLAN_TAGLINE = {
  STARTER: "For a single department getting started.",
  PROFESSIONAL: "For colleges running exams at scale.",
  ENTERPRISE: "For universities with custom needs.",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const rupees = (paise) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const daysLeft = (d) => (d ? Math.max(0, Math.ceil((new Date(d) - new Date()) / 864e5)) : null);
const limit = (n) => (n == null ? "Unlimited" : n.toLocaleString("en-IN"));

function UsageMeter({ icon: Icon, label, current, max }) {
  const unlimited = max == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  const tone = unlimited ? "bg-success" : pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /> {label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {current}<span className="text-muted-foreground"> / {unlimited ? "∞" : max}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: unlimited ? "100%" : `${pct}%`, opacity: unlimited ? 0.35 : 1 }} />
      </div>
      {!unlimited && pct >= 80 && (
        <p className={`mt-1.5 text-xs ${pct >= 100 ? "text-destructive" : "text-warning-foreground"}`}>
          {pct >= 100 ? "Limit reached — upgrade to add more." : "Approaching your plan limit."}
        </p>
      )}
    </div>
  );
}

function planRows(plan) {
  const f = plan.features || {};
  return [
    { label: "Teachers", value: limit(plan.maxTeachers) },
    { label: "Students", value: limit(plan.maxStudents) },
    { label: "Exams", value: limit(plan.maxExams) },
    { label: "Branches & batches", value: plan.maxBranches == null ? "Unlimited" : `${plan.maxBranches} / ${limit(plan.maxBatches)}` },
    { label: "Bulk spreadsheet import", on: !!f.bulkImport },
    { label: "Analytics", on: !!f.analytics },
    { label: "Camera & browser proctoring", on: !!f.proctoring },
    { label: "API access", on: !!f.apiAccess },
  ];
}

export default function BillingPage() {
  const [billing, setBilling] = useState(null);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => { loadBillingData(); }, []);

  async function loadBillingData() {
    setLoading(true);
    setError(null);
    try {
      const [billingRes, paymentsRes, plansRes] = await Promise.all([
        fetch("/api/account/billing").then((r) => r.json()),
        fetch("/api/payments/history").then((r) => r.json()),
        fetch("/api/plans").then((r) => r.json()),
      ]);
      if (billingRes.success) setBilling(billingRes.billing);
      if (paymentsRes.success) setPayments(paymentsRes.payments);
      if (plansRes.success) setPlans(plansRes.plans);
    } catch {
      setError("We couldn't load your billing details. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planType) {
    setUpgrading(planType);
    setError(null);
    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType, gateway: "razorpay" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.gatewayOrderId,
        name: "Testify",
        description: `${planType.charAt(0) + planType.slice(1).toLowerCase()} plan · 30 days`,
        handler: async function (response) {
          const verifyRes = await fetch("/api/payments/webhook/razorpay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) await loadBillingData();
          else setError(verifyData.message || "Payment verification failed. If you were charged, contact support.");
        },
        theme: { color: "#4f6ef7" },
      };

      const open = () => new window.Razorpay(options).open();
      if (window.Razorpay) open();
      else {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = open;
        document.head.appendChild(script);
      }
    } catch (err) {
      setError(err.message || "Couldn't start the payment.");
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/account/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setShowCancelModal(false);
      await loadBillingData();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingState label="Loading billing…" />;

  const status = billing?.subscriptionStatus || "TRIAL";
  const currentType = billing?.planType || "TRIAL";
  const usage = billing?.usage;
  const isLocked = ["TRIAL_EXPIRED", "SUSPENDED", "CANCELLED"].includes(status);
  const currentPlan = plans.find((p) => p.planType === currentType);
  const trialDays = status === "TRIAL" ? daysLeft(billing?.trialEndsAt) : null;
  const periodDays = status === "ACTIVE" ? daysLeft(billing?.currentPeriodEnd) : null;
  const scheduled = billing?.cancellationScheduledAt;

  return (
    <div className="space-y-8">
      <PageHeader title="Billing & plan" description="Your subscription, usage limits and payment history." />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}

      {isLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-medium text-foreground">Your account is read-only</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {status === "TRIAL_EXPIRED" ? "Your free trial has ended." : status === "SUSPENDED" ? "Your subscription has lapsed." : "Your account has been cancelled."}
              {" "}You can still view everything, but new exams, users and changes are blocked
              {status !== "CANCELLED" ? " until you choose a plan below." : "."}
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3" bodyClassName="flex h-full flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current plan</p>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground">{billing?.plan || "Trial"}</h2>
                <StatusBadge tone={SUBSCRIPTION_TONE[status]} dot>{STATUS_LABEL[status]}</StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentPlan && currentPlan.priceInPaise > 0 ? `${rupees(currentPlan.priceInPaise)} per month` : "Free while you evaluate Testify"}
              </p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
          </div>

          <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
            {status === "TRIAL" && (
              <div>
                <p className="text-xs text-muted-foreground">Trial ends</p>
                <p className="mt-0.5 font-medium text-foreground">{fmtDate(billing?.trialEndsAt)}</p>
                {trialDays != null && (
                  <>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, (trialDays / 3) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-warning-foreground">{trialDays} day{trialDays !== 1 ? "s" : ""} left</p>
                  </>
                )}
              </div>
            )}
            {status === "ACTIVE" && (
              <div>
                <p className="text-xs text-muted-foreground">Renews</p>
                <p className="mt-0.5 font-medium text-foreground">{fmtDate(billing?.currentPeriodEnd)}</p>
                {periodDays != null && <p className="mt-1 text-xs text-muted-foreground">in {periodDays} day{periodDays !== 1 ? "s" : ""} · renew manually from this page</p>}
              </div>
            )}
            {isLocked && (
              <div>
                <p className="text-xs text-muted-foreground">Access</p>
                <p className="mt-0.5 font-medium text-destructive">Read-only</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Payment method</p>
              <p className="mt-0.5 font-medium text-foreground">Card, UPI or net banking</p>
              <p className="mt-1 text-xs text-muted-foreground">Processed securely by Razorpay</p>
            </div>
          </div>

          {scheduled && (
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <CalendarClock className="size-4 shrink-0" /> Cancellation scheduled — data will be deleted after {fmtDate(scheduled)}.
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            {status !== "CANCELLED" && (
              <Button onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}>
                {currentType === "TRIAL" || isLocked ? "Choose a plan" : "Change plan"}
              </Button>
            )}
            {status === "ACTIVE" && currentPlan && (
              <Button variant="outline" onClick={() => handleUpgrade(currentType)} disabled={!!upgrading}>
                {upgrading === currentType ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Renew for 30 days
              </Button>
            )}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Usage" description="Resources used against your plan limits.">
          {usage ? (
            <div className="space-y-5">
              <UsageMeter icon={Users} label="Teachers" current={usage.teachers.current} max={usage.teachers.max} />
              <UsageMeter icon={GraduationCap} label="Students" current={usage.students.current} max={usage.students.max} />
              <UsageMeter icon={ClipboardList} label="Exams" current={usage.exams.current} max={usage.exams.max} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Usage data unavailable.</p>
          )}
        </Panel>
      </div>

      {/* Plans */}
      {status !== "CANCELLED" && plans.length > 0 && (
        <section id="plans" className="scroll-mt-24 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Plans</h2>
            <p className="text-sm text-muted-foreground">Monthly billing in INR. Upgrade any time — new limits apply immediately.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const type = plan.planType;
              const isCurrent = currentType === type && status === "ACTIVE";
              const recommended = type === "PROFESSIONAL";
              const direction = PLAN_ORDER[type] > PLAN_ORDER[currentType] ? "Upgrade" : PLAN_ORDER[type] < PLAN_ORDER[currentType] ? "Switch" : "Renew";
              return (
                <div
                  key={type}
                  className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-xs ${recommended ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  {recommended && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">Most popular</span>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    {isCurrent && <StatusBadge tone="success">Current</StatusBadge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{PLAN_TAGLINE[type]}</p>
                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-foreground">{rupees(plan.priceInPaise)}</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </p>
                  <ul className="mb-6 mt-6 space-y-2.5 text-sm">
                    {planRows(plan).map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-3">
                        <span className={row.on === false ? "text-muted-foreground/70" : "text-muted-foreground"}>{row.label}</span>
                        {row.value != null ? (
                          <span className="font-medium text-foreground">{row.value}</span>
                        ) : row.on ? (
                          <Check className="size-4 text-success-foreground" aria-label="Included" />
                        ) : (
                          <Minus className="size-4 text-muted-foreground/60" aria-label="Not included" />
                        )}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleUpgrade(type)}
                    disabled={!!upgrading || isCurrent}
                    variant={recommended ? "default" : "outline"}
                    className="mt-auto w-full"
                  >
                    {upgrading === type ? <><Loader2 className="size-4 animate-spin" /> Opening checkout…</> : isCurrent ? "Your current plan" : `${direction} to ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Payment history */}
      <Panel title="Payment history" noPadding>
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Payments for your subscription will appear here." className="m-5" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Billing period</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Reference</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.paidAt || p.createdAt)}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{p.planType.charAt(0) + p.planType.slice(1).toLowerCase()}</td>
                    <td className="hidden px-5 py-3 text-muted-foreground md:table-cell">
                      {p.billingPeriodStart ? `${fmtDate(p.billingPeriodStart)} – ${fmtDate(p.billingPeriodEnd)}` : "—"}
                    </td>
                    <td className="hidden px-5 py-3 font-mono text-xs text-muted-foreground sm:table-cell">{p.gatewayPaymentId || p.gatewayOrderId || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{rupees(p.amountInPaise)}</td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge tone={PAYMENT_TONE[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Cancel */}
      {status !== "CANCELLED" && !scheduled && (
        <Panel title="Cancel subscription" className="border-destructive/25">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-muted-foreground">
              Your account becomes read-only and all data is kept for 7 days
              {status === "ACTIVE" ? " after your paid period ends" : ""}, then deleted. Export anything you need first.
            </p>
            <Button variant="outline" onClick={() => setShowCancelModal(true)} className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <XCircle className="size-4" /> Cancel subscription
            </Button>
          </div>
        </Panel>
      )}

      <Modal
        open={showCancelModal}
        onClose={() => !cancelling && setShowCancelModal(false)}
        title="Cancel your subscription?"
        description="You can ask support to reverse this during the grace period."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancelling}>Keep subscription</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <><Loader2 className="size-4 animate-spin" /> Cancelling…</> : "Cancel subscription"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> Everyone keeps read-only access for 7 days.</li>
            <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /> After that, users, exams and results are <strong className="text-foreground">permanently deleted</strong>.</li>
          </ul>
          <Field label="Why are you leaving? (optional)">
            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className={selectClass}>
              <option value="">Select a reason…</option>
              <option value="TOO_EXPENSIVE">Too expensive</option>
              <option value="NOT_USING">Not using it enough</option>
              <option value="SWITCHING">Switching to another platform</option>
              <option value="MISSING_FEATURES">Missing features we need</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
