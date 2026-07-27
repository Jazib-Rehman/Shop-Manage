"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }
      toast("Signed in", "success");
      router.replace("/");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast(msg, "error");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-zinc-900 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Shop Manager</h1>
            <p className="text-sm text-zinc-600">Sign in to continue</p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-zinc-800">Email</span>
          <input
            className="input text-base"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-zinc-800">Password</span>
          <input
            className="input text-base"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>
        )}

        <button type="submit" className="btn w-full justify-center text-base" disabled={saving}>
          {saving ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/forgot" className="font-semibold text-teal-800 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-zinc-600">
          No account?{" "}
          <Link href="/signup" className="font-semibold text-teal-800 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
