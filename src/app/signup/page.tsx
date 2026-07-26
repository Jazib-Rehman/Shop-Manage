"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Signup failed");
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6" /><path d="M22 11h-6" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Create shop</h1>
            <p className="text-sm text-zinc-600">Your own empty inventory</p>
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
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>
        )}

        <button type="submit" className="btn w-full justify-center text-base" disabled={saving}>
          {saving ? "Creating…" : "Sign up"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-teal-800 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
