"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";

function ResetForm() {
  const router = useRouter();
  const { toast } = useAlert();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      toast("Password updated", "success");
      router.replace("/login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setError(msg);
      toast(msg, "error");
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">
        Missing reset token. Request a new link from{" "}
        <Link href="/forgot" className="underline">forgot password</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-zinc-800">New password</span>
        <input
          className="input text-base"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          autoFocus
          autoComplete="new-password"
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200">{error}</p>}
      <button type="submit" className="btn w-full justify-center text-base" disabled={saving}>
        {saving ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-zinc-900 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Reset password</h1>
          <p className="mt-1 text-sm text-zinc-600">Choose a new password</p>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
          <ResetForm />
        </Suspense>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/login" className="font-semibold text-teal-800 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
