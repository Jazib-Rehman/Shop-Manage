"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import type { Partner } from "@/lib/types";
import { useShop } from "@/lib/store";

export default function PartnersPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Partner | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [incomePercent, setIncomePercent] = useState("100");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fSearch, setFSearch] = useState("");

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setIncomePercent("100");
    setError("");
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setName(p.name);
    setPhone(p.phone);
    setIncomePercent(String(p.incomePercent ?? 100));
    setError("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pct = Number(incomePercent);
    if (!(pct >= 0 && pct <= 100)) {
      setError("Income % must be 0–100");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.savePartner({
        id: editing?.id,
        name: name.trim(),
        phone: phone.trim(),
        incomePercent: pct,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: Partner) => {
    if (!(await confirm(`Remove partner “${p.name}”?`))) return;
    try {
      await shop.deletePartner(p.id);
      if (editing?.id === p.id) reset();
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const q = fSearch.trim().toLowerCase();
  const rows = q
    ? shop.partners.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.phone || "").toLowerCase().includes(q)
      )
    : shop.partners;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Partners</h1>
          <p className="mt-1 text-sm text-zinc-600 sm:text-base">
            {rows.length} of {shop.partners.length} · income % is their cut of profit from their goods
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <label className="block space-y-1.5 rounded-xl border border-zinc-300 bg-white p-3 shadow-sm sm:max-w-md">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              Search
            </span>
            <input
              className="input text-base"
              placeholder="Name or phone…"
              value={fSearch}
              onChange={(e) => setFSearch(e.target.value)}
            />
          </label>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 && (
              <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
                {shop.partners.length === 0 ? "No partners yet" : "No matches"}
              </div>
            )}
            {rows.map((p) => {
              const his = p.incomePercent ?? 100;
              return (
                <article
                  key={p.id}
                  className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm ${
                    editing?.id === p.id ? "border-teal-600 ring-2 ring-teal-600/20" : "border-zinc-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-zinc-900">{p.name}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">{p.phone || "No phone"}</p>
                    </div>
                    <p className="shrink-0 text-right text-sm">
                      <span className="font-semibold text-zinc-900">Them {his}%</span>
                      <span className="block text-zinc-500">you {100 - his}%</span>
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                    <Link
                      href={`/partners/${p.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-200"
                    >
                      Account
                    </Link>
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                      onClick={() => onDelete(p)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
            <table className="w-full text-left text-base">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
                <tr>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Phone</th>
                  <th className="px-4 py-3.5">Income split</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                      {shop.partners.length === 0 ? "No partners yet" : "No matches"}
                    </td>
                  </tr>
                )}
                {rows.map((p) => {
                  const his = p.incomePercent ?? 100;
                  return (
                    <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-zinc-900">{p.name}</td>
                      <td className="px-4 py-3.5 text-zinc-700">{p.phone || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-zinc-700">
                        <span className="font-semibold text-zinc-900">Them {his}%</span>
                        <span className="text-zinc-500"> · you {100 - his}%</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                        <Link
                          href={`/partners/${p.id}`}
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-sky-800 hover:bg-sky-50"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                          Account
                        </Link>
                        <button
                          type="button"
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                          onClick={() => openEdit(p)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                          onClick={() => onDelete(p)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="order-1 h-fit space-y-5 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5 lg:order-2 lg:sticky lg:top-8"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-teal-700" aria-hidden>
                {editing ? (
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                ) : (
                  <>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M19 8v6" /><path d="M22 11h-6" />
                  </>
                )}
              </svg>
              {editing ? "Edit partner" : "Add partner"}
            </h2>
            {editing && (
              <button type="button" className="text-sm font-semibold text-zinc-600 hover:underline" onClick={reset}>
                New instead
              </button>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              Name
            </span>
            <input className="input text-base" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Phone
            </span>
            <input className="input text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Their income %
            </span>
            <input
              className="input text-base"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={incomePercent}
              onChange={(e) => setIncomePercent(e.target.value)}
              required
            />
            <span className="text-sm text-zinc-600">
              Of their goods’ profit: them {Number(incomePercent) || 0}% · you {100 - (Number(incomePercent) || 0)}%
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn w-full text-base" disabled={saving}>
            {saving ? "Saving…" : editing ? "Update partner" : "Add partner"}
          </button>
        </form>
      </div>
    </div>
  );
}
