"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { loginService } from "@/lib/api-client/auth.client";
import { useAuth } from "@/context/auth-context";

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await loginService({ email, password });
      login(user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo mark */}
      <div className="flex items-center gap-2 mb-10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-testify-accent flex items-center justify-center text-white font-serif italic text-lg font-bold group-hover:bg-testify-accent2 transition-colors">
            T
          </div>
          <span className="font-serif text-2xl font-bold text-testify-text tracking-tight">Testify</span>
        </Link>
      </div>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-testify-text mb-2 tracking-tight">
          Welcome back
        </h1>
        <p className="text-testify-muted text-base">
          Sign in to your institution account
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400 leading-snug">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-testify-muted2">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            className="w-full h-12 bg-testify-surface border border-testify-border rounded-xl px-4 text-sm text-testify-text placeholder:text-testify-muted2 outline-none focus:border-testify-accent focus:ring-2 focus:ring-testify-accent/20 transition-all"
          />
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-testify-muted2">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-testify-accent hover:text-testify-accent2 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 bg-testify-surface border border-testify-border rounded-xl px-4 pr-12 text-sm text-testify-text placeholder:text-testify-muted2 outline-none focus:border-testify-accent focus:ring-2 focus:ring-testify-accent/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-testify-muted2 hover:text-testify-text transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="mt-2 w-full h-12 rounded-xl bg-testify-accent hover:bg-testify-accent2 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Footer link */}
      <p className="mt-8 text-center text-sm text-testify-muted">
        Don&apos;t have an account? Ask your institution admin, or{" "}
        <Link href="/get-started" className="text-testify-accent hover:text-testify-accent2 font-semibold transition-colors">
          register your college →
        </Link>
      </p>
    </div>
  );
}
