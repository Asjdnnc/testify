"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  UserCircle,
  ShieldCheck,
  Mail,
} from "lucide-react";



import { onboardCollegeClient } from "@/lib/api-client/onboarding.client";

const STEPS = [
  { id: 1, label: "Institution", icon: Building2 },
  { id: 2, label: "Admin Details", icon: UserCircle },
];

const DESIGNATIONS = [
  "Principal",
  "Vice Principal",
  "Controller of Examinations",
  "Dean",
  "HOD / Department Head",
  "Exam Cell Officer",
  "IT Administrator",
  "Other",
];

export function OnboardingForm() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [devSetupUrl, setDevSetupUrl] = useState("");

  const [emailFailed, setEmailFailed] = useState(false);

  const [form, setForm] = useState({
    collegeName: "",
    address: "",
    adminName: "",
    adminEmail: "",
    adminContact: "",
    adminDesignation: "",
  });

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function validateStep() {
    if (step === 1) {
      if (!form.collegeName.trim()) { setError("College / University name is required"); return false; }
    }
    if (step === 2) {
      if (!form.adminName.trim()) { setError("Your full name is required"); return false; }
      if (!form.adminEmail.trim() || !form.adminEmail.includes("@")) { setError("A valid email address is required"); return false; }
      if (!form.adminContact.trim()) { setError("Contact number is required"); return false; }
      if (!form.adminDesignation) { setError("Please select your designation"); return false; }
    }
    return true;
  }

  function next() {
    if (!validateStep()) return;
    setError("");
    setStep((s) => s + 1);
  }

  function back() {
    setError("");
    setStep((s) => s - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    setError("");

    try {
      const result = await onboardCollegeClient({
        collegeName: form.collegeName,
        address: form.address,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminContact: form.adminContact,
        adminDesignation: form.adminDesignation,
      });

      setSubmittedEmail(form.adminEmail);
      if (result.setupUrl) setDevSetupUrl(result.setupUrl);
      if (result.emailFailed) setEmailFailed(true);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Success state ────────────────────────────────────────────────────── */
  if (done) {
    return (
      <div className="flex flex-col items-center text-center py-8 gap-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${emailFailed ? "bg-red-500/10 border-red-500/30" : "bg-testify-accent/10 border-testify-accent/30"}`}>
          {emailFailed ? <AlertCircle size={32} className="text-red-500" /> : <Mail size={32} className="text-testify-accent" />}
        </div>
        <div>
          <h2 className="font-serif text-3xl text-testify-text mb-2">
            {emailFailed ? "Registration Successful" : "Check your inbox!"}
          </h2>
          <p className="text-testify-muted text-base leading-relaxed">
            {emailFailed ? (
              <>
                We couldn't send the setup link to <strong className="text-testify-text">{submittedEmail}</strong> because our email service is currently down.
              </>
            ) : (
              <>
                We sent a setup link to{" "}
                <strong className="text-testify-text">{submittedEmail}</strong>.<br />
                Click the link in the email to set your password and access your dashboard.
              </>
            )}
          </p>
        </div>
        
        {!emailFailed && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-left max-w-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 mt-1.5" />
            <p className="text-xs text-amber-400/90 leading-relaxed">
              <strong>3-day trial starts now.</strong> The setup link expires in 24 hours — check spam if you don't see it.
            </p>
          </div>
        )}

        {(devSetupUrl || emailFailed) && (
          <div className={`w-full p-4 rounded-xl text-left space-y-2 ${emailFailed ? "bg-red-500/5 border border-red-500/20" : "bg-indigo-500/5 border border-indigo-500/20"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${emailFailed ? "text-red-400" : "text-indigo-400"}`}>
              {emailFailed ? "Action Required" : "🛠 Dev mode — direct setup link"}
            </p>
            <p className="text-xs text-testify-muted leading-relaxed">
              {emailFailed ? "Please use the direct link below to complete your setup and create your password immediately:" : "Email delivery requires a verified Resend domain in production. Use this link now:"}
            </p>
            <a
              href={devSetupUrl || "#"}
              className={`block text-xs underline break-all transition-colors ${emailFailed ? "text-red-400 hover:text-red-300" : "text-indigo-400 hover:text-indigo-300"}`}
            >
              {devSetupUrl || "Token link unavailable. Check server console."}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-testify-accent flex items-center justify-center text-white font-serif italic text-lg font-bold group-hover:bg-testify-accent2 transition-colors">
            T
          </div>
          <span className="font-serif text-2xl font-bold text-testify-text tracking-tight">Testify</span>
        </Link>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isDone = step > s.id;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300
                    ${isDone ? "bg-testify-accent border-testify-accent" : isActive ? "bg-[rgba(79,110,247,0.12)] border-testify-accent" : "bg-testify-surface border-testify-border"}
                  `}
                >
                  {isDone
                    ? <CheckCircle2 size={16} className="text-white" />
                    : <Icon size={15} className={isActive ? "text-testify-accent" : "text-testify-muted2"} />
                  }
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${isActive ? "text-testify-accent" : isDone ? "text-testify-muted" : "text-testify-muted2"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 mb-5 transition-colors duration-300 ${isDone ? "bg-testify-accent" : "bg-testify-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Heading */}
      <div className="mb-8">
        {step === 1 && <>
          <h1 className="font-serif text-4xl text-testify-text mb-2 tracking-tight">Register your institution</h1>
          <p className="text-testify-muted text-base">Tell us about your college or university.</p>
        </>}
        {step === 2 && <>
          <h1 className="font-serif text-4xl text-testify-text mb-2 tracking-tight">About you</h1>
          <p className="text-testify-muted text-base">You'll be the admin of your institution's workspace.</p>
        </>}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error}</p>
        </div>
      )}

      <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); next(); }} className="flex flex-col gap-5">

        {/* ── Step 1: Institution ──────────────────────────────── */}
        {step === 1 && (
          <>
            <Field label="College / University name *">
              <input
                id="college-name"
                type="text"
                placeholder="e.g. SRM Institute of Science & Technology"
                required
                value={form.collegeName}
                onChange={(e) => set("collegeName", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Address / City (optional)">
              <textarea
                id="college-address"
                placeholder="123 Main Street, Chennai, Tamil Nadu"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={3}
                className={`${inputClass} h-auto resize-none py-3`}
              />
            </Field>

            {/* Trust note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-testify-surface border border-testify-border text-xs text-testify-muted leading-relaxed">
              <ShieldCheck size={14} className="text-testify-accent mt-0.5 shrink-0" />
              <p>Your data is encrypted and never shared. You get a <strong className="text-testify-text">3-day free trial</strong> — no credit card required.</p>
            </div>
          </>
        )}

        {/* ── Step 2: Admin Details ────────────────────────────── */}
        {step === 2 && (
          <>
            <Field label="Full name *">
              <input id="admin-name" type="text" placeholder="Dr. Rajan Mehta" required value={form.adminName}
                onChange={(e) => set("adminName", e.target.value)} className={inputClass} />
            </Field>

            <Field label="Official email address *">
              <input id="admin-email" type="email" autoComplete="email" placeholder="r.mehta@srmist.edu.in" required
                value={form.adminEmail} onChange={(e) => set("adminEmail", e.target.value)} className={inputClass} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact number *">
                <input id="admin-contact" type="tel" placeholder="+91 98765 43210" required value={form.adminContact}
                  onChange={(e) => set("adminContact", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Designation *">
                <select id="admin-designation" required value={form.adminDesignation}
                  onChange={(e) => set("adminDesignation", e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="" disabled>Select…</option>
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            {/* ── Step 2 Summary / Submit preview ───────────────────── */}
            <div className="p-4 rounded-xl bg-testify-surface border border-testify-border text-sm flex flex-col gap-2 mt-1">
              <p className="text-xs uppercase font-bold tracking-wider text-testify-muted2 mb-1">Account summary</p>
              <Row label="Institution" value={form.collegeName} />
              <Row label="Admin" value={form.adminName} />
              <Row label="Email" value={form.adminEmail} />
              <Row label="Role" value={form.adminDesignation} />
              <div className="pt-2 mt-1 border-t border-testify-border flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400 font-medium">You'll receive a setup email to set your password</span>
              </div>
            </div>
          </>
        )}

        {/* ── Navigation Buttons ────────────────────────────────── */}
        <div className={`flex gap-3 mt-2 ${step > 1 ? "flex-row" : "flex-col"}`}>
          {step > 1 && (
            <button type="button" onClick={back}
              className="flex-1 h-12 rounded-xl border border-testify-border text-testify-text text-sm font-semibold flex items-center justify-center gap-2 hover:bg-testify-surface transition-colors">
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <button type="submit" disabled={loading}
            className="flex-1 h-12 rounded-xl bg-testify-accent hover:bg-testify-accent2 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Registering…</>
            ) : step < 2 ? (
              <>Continue <ArrowRight size={16} /></>
            ) : (
              <>Send setup email <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-testify-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-testify-accent hover:text-testify-accent2 font-semibold transition-colors">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

/* ── Tiny helpers ─────────────────────────────────────────────────── */

const inputClass =
  "w-full h-12 bg-testify-surface border border-testify-border rounded-xl px-4 text-sm text-testify-text placeholder:text-testify-muted2 outline-none focus:border-testify-accent focus:ring-2 focus:ring-testify-accent/20 transition-all";

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-testify-muted2">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-testify-muted text-xs">{label}</span>
      <span className="text-testify-text text-xs font-medium truncate max-w-[60%] text-right">{value || "—"}</span>
    </div>
  );
}
