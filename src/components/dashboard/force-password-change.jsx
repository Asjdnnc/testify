"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ShieldAlert, Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function ForcePasswordChange() {
  const { user, refreshUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setDone(true);
      // Wait for user to see success then refresh
      setTimeout(async () => {
        await refreshUser();
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-success/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Security Updated</h2>
            <p className="text-muted-foreground text-sm">
              Your password has been set successfully. Redirecting you to the dashboard…
            </p>
          </div>
          <div className="flex justify-center gap-1.5 pt-2">
            <div className="w-2 h-2 rounded-full bg-primary delay-0" />
            <div className="w-2 h-2 rounded-full bg-primary delay-150" />
            <div className="w-2 h-2 rounded-full bg-primary delay-300" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-card border rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="space-y-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto rotate-12 group-hover:rotate-0 transition-transform">
            <ShieldAlert className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Secure Your Account</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, <span className="text-foreground font-semibold">{user?.name}</span>. 
            Since this is your first time logging in with temporary credentials, you must set a new password.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">
              New Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                className="w-full h-11 pl-10 pr-12 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Strength Indicator */}
            <div className="flex gap-1.5 px-1 mt-2">
              {[1, 2, 3, 4].map((level) => (
                <div 
                  key={level} 
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${password.length >= level * 2 ? (password.length > 10 ? 'bg-success' : 'bg-primary') : 'bg-muted'}`} 
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground tracking-wide pl-1">
              Confirm New Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                required
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || password.length < 8 || password !== confirm}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Activate My Account
          </button>
        </form>

        <p className="text-xs text-center text-muted-foreground leading-relaxed px-4">
          By activating your account, you agree to our terms of service and institutional data security protocols.
        </p>
      </div>
    </div>
  );
}
