"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { money } from "@/lib/calc";
import type { Expense } from "@/lib/types";
import { useShop } from "@/lib/store";

const CATEGORIES = [
  "Rent",
  "Salary",
  "Utilities",
  "Electricity",
  "Water",
  "Gas",
  "Internet / Phone",
  "Maintenance",
  "Cleaning",
  "Transport",
  "Office supplies",
  "Equipment",
  "Taxes / Fees",
  "Insurance",
  "Marketing",
  "Miscellaneous",
  "Other",
] as const;

const categoryTone: Record<string, string> = {
  Rent: "bg-violet-50 text-violet-800 ring-violet-200",
  Salary: "bg-sky-50 text-sky-800 ring-sky-200",
  Utilities: "bg-amber-50 text-amber-900 ring-amber-200",
  Electricity: "bg-yellow-50 text-yellow-900 ring-yellow-200",
  Water: "bg-cyan-50 text-cyan-900 ring-cyan-200",
  Gas: "bg-orange-50 text-orange-900 ring-orange-200",
  "Internet / Phone": "bg-indigo-50 text-indigo-800 ring-indigo-200",
  Maintenance: "bg-rose-50 text-rose-800 ring-rose-200",
  Cleaning: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  Transport: "bg-teal-50 text-teal-800 ring-teal-200",
  "Office supplies": "bg-zinc-100 text-zinc-800 ring-zinc-300",
  Equipment: "bg-blue-50 text-blue-800 ring-blue-200",
  "Taxes / Fees": "bg-red-50 text-red-800 ring-red-200",
  Insurance: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  Marketing: "bg-pink-50 text-pink-800 ring-pink-200",
  Miscellaneous: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  Other: "bg-zinc-100 text-zinc-700 ring-zinc-300",
};

function badgeClass(category: string) {
  return categoryTone[category] || "bg-zinc-100 text-zinc-700 ring-zinc-300";
}

export default function ExpensesPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [category, setCategory] = useState<string>("Rent");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fSearch, setFSearch] = useState("");
  const [fCategory, setFCategory] = useState("");

  const all = shop.expenses ?? [];
  const rows = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return all.filter((e) => {
      if (fCategory && e.category !== fCategory) return false;
      if (!q) return true;
      return (
        e.category.toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q)
      );
    });
  }, [all, fSearch, fCategory]);

  const total = rows.reduce((s, e) => s + e.amount, 0);
  const editOptions = useMemo(() => {
    if (editing && !CATEGORIES.includes(editing.category as (typeof CATEGORIES)[number])) {
      return [editing.category, ...CATEGORIES];
    }
    return [...CATEGORIES];
  }, [editing]);

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const reset = () => {
    setEditing(null);
    setCategory("Rent");
    setAmount("");
    setDescription("");
    setError("");
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setCategory(e.category);
    setAmount(String(e.amount));
    setDescription(e.description || "");
    setError("");
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const amt = Number(amount);
    if (!category.trim() || !(amt > 0)) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveExpense({
        id: editing?.id,
        category: category.trim(),
        amount: amt,
        description: description.trim(),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (e: Expense) => {
    if (!(await confirm(`Delete ${e.category} · ${money(e.amount)}?`))) return;
    try {
      await shop.deleteExpense(e.id);
      if (editing?.id === e.id) reset();
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Expenses</h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              Track shop rent, salaries, bills, and operating costs
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[17rem]">
          <div className="rounded-xl border border-zinc-300 bg-white px-3.5 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">{money(total)}</p>
          </div>
          <div className="rounded-xl border border-zinc-300 bg-white px-3.5 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entries</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900">{rows.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:gap-6">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="grid gap-3 rounded-2xl border border-zinc-300 bg-white p-3 shadow-sm sm:grid-cols-2 sm:p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-zinc-800">Search</span>
              <input
                className="input text-base"
                placeholder="Description or category…"
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-zinc-800">Filter category</span>
              <select className="input text-base" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.length === 0 && (
              <div className="rounded-2xl border border-zinc-300 bg-white px-4 py-12 text-center text-zinc-600 shadow-sm">
                {all.length === 0 ? "No expenses yet — record one on the right" : "No matches"}
              </div>
            )}
            {rows.map((e) => (
              <article
                key={e.id}
                className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${
                  editing?.id === e.id ? "border-teal-600 ring-2 ring-teal-600/15" : "border-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClass(e.category)}`}>
                      {e.category}
                    </span>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                      {e.description || "No description"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{new Date(e.spentAt).toLocaleDateString()}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-zinc-900">{money(e.amount)}</p>
                </div>
                <div className="mt-3 flex gap-1.5 border-t border-zinc-100 pt-3">
                  <button type="button" className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200" onClick={() => openEdit(e)}>
                    Edit
                  </button>
                  <button type="button" className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200" onClick={() => onDelete(e)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm md:block">
            <table className="w-full text-left text-base">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
                <tr>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-600">
                      {all.length === 0 ? "No expenses yet" : "No matches"}
                    </td>
                  </tr>
                )}
                {rows.map((e) => (
                  <tr key={e.id} className={`border-b border-zinc-100 last:border-0 ${editing?.id === e.id ? "bg-teal-50/40" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-600">
                      {new Date(e.spentAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClass(e.category)}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="max-w-[20rem] truncate px-4 py-3.5 text-zinc-700">{e.description || "—"}</td>
                    <td className="px-4 py-3.5 tabular-nums font-bold text-zinc-900">{money(e.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                      <button type="button" className="mr-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50" onClick={() => openEdit(e)}>
                        Edit
                      </button>
                      <button type="button" className="rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50" onClick={() => onDelete(e)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="order-1 h-fit overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm lg:order-2 lg:sticky lg:top-8"
        >
          <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">{editing ? "Edit expense" : "Record expense"}</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  {editing ? "Changes save to this entry" : `Recorded as ${new Date().toLocaleDateString()}`}
                </p>
              </div>
              {editing && (
                <button type="button" className="shrink-0 text-sm font-semibold text-teal-800 hover:underline" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-zinc-800">Category</span>
              <select
                className="input text-base"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {editOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-zinc-800">Amount (Rs)</span>
              <input
                className="input text-base"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-zinc-800">Description</span>
              <textarea
                className="input min-h-28 resize-y text-base"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. March shop rent, shopkeeper salary…"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">{error}</p>
            )}

            <button type="submit" className="btn w-full text-base" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
