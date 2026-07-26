"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setDone("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setDone(data.message || "Check your email for a reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-zinc-900 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Forgot password</h1>
          <p className="mt-1 text-sm text-zinc-600">We’ll email you a reset link</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-zinc-800">Email</span>
          <input
            className="input text-base"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
        {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">{done}</p>}
        <button type="submit" className="btn w-full justify-center text-base" disabled={saving}>
          {saving ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/login" className="font-semibold text-teal-800 hover:underline">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
