"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard, ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  Pencil, X, Save, Infinity, ToggleLeft, ToggleRight,
} from "lucide-react";

const PLAN_COLORS = {
  TRIAL: "text-warning-foreground border-warning/40 bg-amber-500/10",
  STARTER: "text-blue-500 border-blue-500/30 bg-blue-500/10",
  PROFESSIONAL: "text-primary border-primary bg-primary/10",
  ENTERPRISE: "text-purple-500 border-purple-500/30 bg-purple-500/10",
};

const RESOURCE_FIELDS = [
  { key: "maxTeachers", label: "Max Teachers" },
  { key: "maxStudents", label: "Max Students" },
  { key: "maxExams", label: "Max Exams" },
  { key: "durationDays", label: "Duration (Days)" },
];


const FEATURE_KEYS = ["proctoring", "analytics", "bulkImport", "apiAccess"];
const FEATURE_LABELS = {
  proctoring: "Proctoring",
  analytics: "Analytics",
  bulkImport: "Bulk Import",
  apiAccess: "API Access",
};

function NullableNumberInput({ value, onChange }) {
  const isUnlimited = value === null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(isUnlimited ? 10 : null)}
        className={`shrink-0 p-1.5 rounded-lg border transition-colors ${
          isUnlimited ? "bg-primary/15 border-primary text-primary" : "bg-muted border-border text-muted-foreground"
        }`}
        title={isUnlimited ? "Currently unlimited — click to set a limit" : "Click to set unlimited"}
      >
        <Infinity className="w-3.5 h-3.5" />
      </button>
      {!isUnlimited ? (
        <input
          type="number"
          min="0"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
          className="w-20 h-8 px-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <span className="text-sm text-muted-foreground ">Unlimited</span>
      )}
    </div>
  );
}

function PlanCard({ plan, onSave }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [draft, setDraft] = useState({ ...plan, features: { ...plan.features } });

  function setField(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setFeature(key, value) {
    setDraft((prev) => ({ ...prev, features: { ...prev.features, [key]: value } }));
  }

  function cancelEdit() {
    setDraft({ ...plan, features: { ...plan.features } });
    setEditing(false);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/super-admin/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setSuccess(true);
      setEditing(false);
      onSave(data.plan);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const colorClass = PLAN_COLORS[plan.planType] || PLAN_COLORS.STARTER;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden transition-all">
      {/* Plan header */}
      <div className={`px-6 py-4 border-b flex items-center justify-between ${colorClass} border-0 bg-opacity-100`}
        style={{ background: "transparent" }}>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
            {plan.planType}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{plan.name}</h3>
            <p className="text-sm text-muted-foreground">
              ₹{((plan.priceInPaise || 0) / 100).toFixed(0)}/
              {plan.durationDays >= 30 ? "month" : `${plan.durationDays} days`}
              {plan.priceInPaise === 0 && " · Free"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {success && <CheckCircle2 className="w-4 h-4 text-success-foreground" />}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground transition-all"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Pricing */}
        {editing && (
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3">Pricing</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Price (Paise)</label>
                <input
                  type="number" min="0" value={draft.priceInPaise ?? 0}
                  onChange={(e) => setField("priceInPaise", parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">= ₹{((draft.priceInPaise || 0) / 100).toFixed(2)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duration (Days)</label>
                <input
                  type="number" min="1" value={draft.durationDays}
                  onChange={(e) => setField("durationDays", parseInt(e.target.value, 10) || 30)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Resource limits */}
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3">Resource Limits</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {RESOURCE_FIELDS.filter((f) => f.key !== "durationDays" || !editing).map(({ key, label }) => (
              <div key={key} className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                {editing && key !== "durationDays" ? (
                  <NullableNumberInput
                    value={draft[key]}
                    onChange={(v) => setField(key, v)}
                  />
                ) : (
                  <p className="font-semibold text-foreground text-sm">
                    {plan[key] === null ? "∞ Unlimited" : plan[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3">Features</p>
          <div className="grid grid-cols-2 gap-2">
            {FEATURE_KEYS.map((key) => {
              const enabled = editing ? draft.features?.[key] : plan.features?.[key];
              return (
                <div key={key} className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5">
                  <span className="text-sm text-foreground">{FEATURE_LABELS[key]}</span>
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => setFeature(key, !draft.features?.[key])}
                      className={`transition-colors ${draft.features?.[key] ? "text-success-foreground" : "text-muted-foreground"}`}
                    >
                      {draft.features?.[key] ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      enabled ? "bg-emerald-500/15 text-success-foreground" : "bg-muted text-muted-foreground"
                    }`}>{enabled ? "Yes" : "No"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active toggle */}
        {editing && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Plan Active</p>
              <p className="text-xs text-muted-foreground">Inactive plans won't appear on the pricing page</p>
            </div>
            <button
              type="button"
              onClick={() => setField("isActive", !draft.isActive)}
              className={`transition-colors ${draft.isActive ? "text-success-foreground" : "text-muted-foreground"}`}
            >
              {draft.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/super-admin/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPlans(d.plans);
        else setError(d.message);
      })
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  function handlePlanSave(updated) {
    setPlans((prev) => prev.map((p) => (p.planType === updated.planType ? updated : p)));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plans & pricing</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Edit pricing, resource limits and feature flags for each plan. Changes apply immediately.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard key={plan.planType} plan={plan} onSave={handlePlanSave} />
          ))}
        </div>
      )}
    </div>
  );
}
