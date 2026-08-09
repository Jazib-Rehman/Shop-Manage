"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { money } from "@/lib/calc";
import { remainingBalance } from "@/lib/payment";
import type { Customer } from "@/lib/types";
import { useShop } from "@/lib/store";

export default function CustomersPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [arrears, setArrears] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fSearch, setFSearch] = useState("");

  const dueByCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of shop.customers) {
      const arrears = Math.max(0, c.arrears || 0);
      if (arrears > 0) m.set(c.id, arrears);
    }
    for (const s of shop.sales) {
      if (!s.customerId) continue;
      const due = remainingBalance(s.total, s.amountPaid || 0);
      if (due <= 0) continue;
      m.set(s.customerId, (m.get(s.customerId) || 0) + due);
    }
    return m;
  }, [shop.sales, shop.customers]);

  const totalReceivable = useMemo(
    () => [...dueByCustomer.values()].reduce((a, b) => a + b, 0),
    [dueByCustomer]
  );

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const reset = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setArrears("");
    setError("");
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setArrears(c.arrears ? String(c.arrears) : "");
    setError("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveCustomer({
        id: editing?.id,
        name: name.trim(),
        phone: phone.trim(),
        arrears: Math.max(0, Number(arrears) || 0),
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (c: Customer) => {
    if (!(await confirm(`Remove customer “${c.name}”?`))) return;
    try {
      await shop.deleteCustomer(c.id);
      if (editing?.id === c.id) reset();
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const q = fSearch.trim().toLowerCase();
  const rows = q
    ? shop.customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
      )
    : shop.customers;

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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-zinc-600 sm:text-base">
            {rows.length} of {shop.customers.length}
            {totalReceivable > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-amber-800">Receivable {money(totalReceivable)}</span>
              </>
            )}
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
                {shop.customers.length === 0 ? "No customers yet" : "No matches"}
              </div>
            )}
            {rows.map((c) => (
              <article
                key={c.id}
                className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm ${
                  editing?.id === c.id ? "border-teal-600 ring-2 ring-teal-600/20" : "border-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/customers/${c.id}`} className="truncate font-bold text-teal-900 hover:underline">{c.name}</Link>
                  {(dueByCustomer.get(c.id) || 0) > 0 && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-800">
                      {money(dueByCustomer.get(c.id)!)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-600">{c.phone || "No phone"}</p>
                <div className="mt-3 flex gap-1.5 border-t border-zinc-100 pt-3">
                  <Link
                    href={`/customers/${c.id}`}
                    className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
                  >
                    Details
                  </Link>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                    onClick={() => openEdit(c)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                    onClick={() => onDelete(c)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
            <table className="w-full text-left text-base">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
                <tr>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Phone</th>
                  <th className="px-4 py-3.5 text-right">Receivable</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                      {shop.customers.length === 0 ? "No customers yet" : "No matches"}
                    </td>
                  </tr>
                )}
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3.5">
                      <Link href={`/customers/${c.id}`} className="font-semibold text-teal-900 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700">{c.phone || "—"}</td>
                    <td
                      className={`px-4 py-3.5 text-right tabular-nums font-semibold ${
                        (dueByCustomer.get(c.id) || 0) > 0 ? "text-amber-800" : "text-zinc-400"
                      }`}
                    >
                      {money(dueByCustomer.get(c.id) || 0)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                      <Link
                        href={`/customers/${c.id}`}
                        className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        Details
                      </Link>
                      <button
                        type="button"
                        className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                        onClick={() => openEdit(c)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(c)}
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
                ))}
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
              {editing ? "Edit customer" : "Add customer"}
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
            <input className="input text-base" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Previous arrears
            </span>
            <input
              className="input text-base"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={arrears}
              onChange={(e) => setArrears(e.target.value)}
            />
            <span className="text-xs text-zinc-500">Opening balance owed (before app sales)</span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn w-full text-base" disabled={saving}>
            {saving ? "Saving…" : editing ? "Update customer" : "Add customer"}
          </button>
        </form>
      </div>
    </div>
  );
}
