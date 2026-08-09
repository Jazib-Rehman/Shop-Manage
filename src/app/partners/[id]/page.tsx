"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useAlert } from "@/components/Alert";
import { money, sqft } from "@/lib/calc";
import { mySharePercent, productLabel, type Partner, type PartnerLedgerEntry } from "@/lib/types";
import { useShop } from "@/lib/store";

type Breakdown = {
  sale_share: number;
  purchase_share: number;
  freight_share: number;
  loss_share: number;
  surplus_share: number;
  payout: number;
  adjustment: number;
  investment: number;
};

type Book = {
  partner: Partner;
  credit: number;
  debit: number;
  balance: number;
  invested: number;
  breakdown: Breakdown;
  entries: PartnerLedgerEntry[];
};

const DEBIT_TYPES = new Set(["payout", "loss_share"]);
const INVESTMENT_TYPES = new Set(["purchase_share", "freight_share", "investment", "ownership_share"]);

function lastNDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      {children}
    </svg>
  );
}

function CashFlowBars({
  days,
  inn,
  out,
}: {
  days: string[];
  inn: number[];
  out: number[];
}) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const maxBar = Math.max(1, ...inn, ...out);
  return (
    <>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex h-40 min-w-[28rem] items-end gap-1.5">
          {days.map((d, i) => (
            <div
              key={d}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
              onMouseEnter={(e) => setTip({ i, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setTip({ i, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTip(null)}
              onTouchStart={(e) => {
                const t = e.touches[0];
                setTip({ i, x: t.clientX, y: t.clientY });
              }}
            >
              <div className="flex h-32 w-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-teal-600/90"
                  style={{ height: `${(inn[i] / maxBar) * 100}%`, minHeight: inn[i] ? 2 : 0 }}
                />
                <div
                  className="w-1/2 max-w-[14px] rounded-t bg-zinc-300"
                  style={{ height: `${(out[i] / maxBar) * 100}%`, minHeight: out[i] ? 2 : 0 }}
                />
              </div>
              <span className="truncate text-xs font-medium text-zinc-500">{d.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-max max-w-[11rem] rounded-lg bg-zinc-900 px-2.5 py-2 text-left text-xs font-medium text-white shadow-lg"
          style={{ left: tip.x + 12, top: tip.y - 8, transform: "translateY(-100%)" }}
        >
          <p className="mb-1 font-semibold text-zinc-200">
            {new Date(days[tip.i] + "T12:00:00").toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="tabular-nums text-teal-300">In: {money(inn[tip.i])}</p>
          <p className="tabular-nums text-zinc-300">Out: {money(out[tip.i])}</p>
        </div>
      )}
    </>
  );
}

export default function PartnerBookPage() {
  const { id } = useParams<{ id: string }>();
  const shop = useShop();
  const { alert, confirm, toast } = useAlert();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<PartnerLedgerEntry | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/partners/${id}/ledger`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load");
      return;
    }
    setBook(data);
  }, [id]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const closeEntry = () => {
    setEntryOpen(false);
    setEditId(null);
    setAmount("");
    setNote("");
  };

  const openCreate = () => {
    setEditId(null);
    setAmount("");
    setNote("");
    setEntryOpen(true);
  };

  const openEdit = (e: PartnerLedgerEntry) => {
    if (e.type !== "payout") return;
    setEditId(e.id);
    setAmount(String(e.amount));
    setNote(e.note || "");
    setEntryOpen(true);
  };

  const onSaveEntry = async (ev: FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editId ? `/api/partners/${id}/ledger/${editId}` : `/api/partners/${id}/ledger`,
        {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "payout", amount: Number(amount), note }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const wasEdit = !!editId;
      closeEntry();
      await load();
      toast(wasEdit ? "Entry updated" : "Entry added", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast(msg, "error");
      await alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteEntry = async (e: PartnerLedgerEntry) => {
    if (e.type !== "investment" && e.type !== "payout" && e.type !== "adjustment") return;
    if (!(await confirm(`Delete this ${e.type}?`))) return;
    try {
      const res = await fetch(`/api/partners/${id}/ledger/${e.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      toast("Entry deleted", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast(msg, "error");
      await alert(msg);
    }
  };

  const shared = useMemo(
    () =>
      shop.ready
        ? shop.products.filter((p) => p.shares?.some((s) => s.partnerId === id && s.percent > 0))
        : [],
    [shop, id]
  );

  const days = lastNDays(14);
  const chart = useMemo(() => {
    if (!book) return { in: days.map(() => 0), out: days.map(() => 0) };
    const byDay = (pred: (t: string) => boolean) =>
      days.map((d) =>
        book.entries
          .filter((e) => e.date.slice(0, 10) === d && pred(e.type) && !INVESTMENT_TYPES.has(e.type))
          .reduce((s, e) => s + e.amount, 0)
      );
    return {
      in: byDay((t) => !DEBIT_TYPES.has(t)),
      out: byDay((t) => DEBIT_TYPES.has(t)),
    };
  }, [book, days]);

  if (error) return <p className="text-base font-medium text-red-700">{error}</p>;
  if (!book) return <p className="text-base text-zinc-600">Loading…</p>;

  const typeLabel: Record<string, string> = {
    sale_share: "Sale profit",
    purchase_share: "Investment",
    freight_share: "Freight",
    ownership_share: "Ownership",
    loss_share: "Loss",
    surplus_share: "Surplus",
    investment: "Legacy investment",
    payout: "Payout",
    adjustment: "Adjustment",
  };

  const his = book.partner.incomePercent ?? 100;
  const b = book.breakdown || {
    sale_share: 0,
    purchase_share: 0,
    freight_share: 0,
    loss_share: 0,
    surplus_share: 0,
    payout: 0,
    adjustment: 0,
    investment: 0,
  };
  const invested = book.invested ?? b.purchase_share + b.freight_share + b.investment;
  const flowTotal = Math.max(1, book.credit + book.debit);

  const stats = [
    {
      label: "Sale profit",
      value: money(b.sale_share),
      color: "text-emerald-700",
      icon: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    },
    {
      label: "Investment",
      value: money(invested),
      color: "text-teal-800",
      icon: (
        <>
          <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
        </>
      ),
    },
    {
      label: "Payouts",
      value: money(b.payout),
      color: "text-zinc-900",
      icon: <><path d="M12 19V5" /><path d="M5 12h14" /></>,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-teal-900 to-teal-700 px-4 py-5 text-white shadow-sm sm:px-6 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <Link
          href="/partners"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-100/90 hover:text-white sm:text-base"
        >
          <Icon className="h-4 w-4"><path d="m15 18-6-6 6-6" /></Icon>
          Partners
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-12 sm:w-12">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </Icon>
            </span>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{book.partner.name}</h1>
              <p className="mt-1 text-sm text-teal-50/90 sm:mt-1.5 sm:text-base">
                Account book
                {book.partner.phone ? ` · ${book.partner.phone}` : ""}
                {" · "}
                Income them {his}% / you {100 - his}%
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur-sm sm:px-5 sm:py-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-100/90">
              <Icon className="h-4 w-4">
                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
              </Icon>
              Balance
            </p>
            <p className="mt-1 break-words text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{money(book.balance)}</p>
            <p className="mt-1 text-xs text-teal-100/80">
              Profit − loss − payouts · Investment {money(invested)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-3 shadow-sm sm:p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 sm:text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800 sm:h-8 sm:w-8">
                <Icon className="h-4 w-4">{s.icon}</Icon>
              </span>
              <span className="truncate">{s.label}</span>
            </p>
            <p className={`mt-2 break-words text-lg font-bold tabular-nums sm:mt-2.5 sm:text-2xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 sm:text-lg">
                <Icon className="h-5 w-5 text-teal-700">
                  <path d="M3 3v18h18" /><path d="M7 16v-5" /><path d="M12 16V8" /><path d="M17 16v-9" />
                </Icon>
                Cash flow
              </h2>
              <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">Last 14 days · in vs out</p>
            </div>
            <div className="flex gap-4 text-sm font-semibold text-zinc-700">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-600" /> In</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> Out</span>
            </div>
          </div>
          <CashFlowBars days={days} inn={chart.in} out={chart.out} />
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 sm:text-lg">
            <Icon className="h-5 w-5 text-teal-700">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
            </Icon>
            Activity mix
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">Credit vs debit volume</p>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-zinc-100">
            <div className="bg-emerald-500" style={{ width: `${(book.credit / flowTotal) * 100}%` }} />
            <div className="bg-zinc-400" style={{ width: `${(book.debit / flowTotal) * 100}%` }} />
          </div>
          <dl className="mt-5 space-y-2.5 text-base">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-700">Total in</dt>
              <dd className="tabular-nums font-bold text-emerald-700">{money(book.credit)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-700">Total out</dt>
              <dd className="tabular-nums font-bold text-zinc-900">{money(book.debit)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2.5">
              <dt className="text-zinc-700">Entries</dt>
              <dd className="tabular-nums font-bold text-zinc-900">{book.entries.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-700">Shared SKUs</dt>
              <dd className="tabular-nums font-bold text-zinc-900">{shared.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-teal-700">
              <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
              <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
            </Icon>
            <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Ledger</h2>
          </div>
          <button type="button" className="btn w-full justify-center text-base sm:w-auto" onClick={openCreate}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 h-4 w-4" aria-hidden>
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Record payout
          </button>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-zinc-100 md:hidden">
          {book.entries.length === 0 && (
            <p className="px-4 py-10 text-center text-zinc-600">
              No entries yet — shared purchases/sales appear here; record a payout when you pay them
            </p>
          )}
          {book.entries.map((e) => {
            const out = DEBIT_TYPES.has(e.type);
            const invest = INVESTMENT_TYPES.has(e.type);
            const canEdit = e.type === "payout";
            const canDelete = e.type === "payout" || e.type === "adjustment" || e.type === "investment";
            const prod = e.productId ? shop.products.find((p) => p.id === e.productId) : undefined;
            return (
              <article key={e.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900">{typeLabel[e.type] || e.type}</p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      {new Date(e.date).toLocaleDateString()}
                      {e.qty ? ` · ${sqft(e.qty, prod?.unit)}` : ""}
                    </p>
                    {e.note && <p className="mt-1 truncate text-sm text-zinc-500">{e.note}</p>}
                  </div>
                  <p
                    className={`shrink-0 text-base font-bold tabular-nums ${
                      invest ? "text-teal-800" : out ? "text-zinc-900" : "text-emerald-700"
                    }`}
                  >
                    {invest ? "" : out ? "−" : "+"}
                    {money(e.amount)}
                  </p>
                </div>
                {(canEdit || canDelete) && (
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
                      onClick={() => setDetailOpen(e)}
                    >
                      Details
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                        onClick={() => openEdit(e)}
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                        onClick={() => onDeleteEntry(e)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
                {!canEdit && !canDelete && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
                      onClick={() => setDetailOpen(e)}
                    >
                      Details
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-base">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Qty</th>
                <th className="px-4 py-3.5">Amount</th>
                <th className="px-4 py-3.5">Note</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {book.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                    No entries yet — shared purchases/sales appear here; record a payout when you pay them
                  </td>
                </tr>
              )}
              {book.entries.map((e) => {
                const out = DEBIT_TYPES.has(e.type);
                const invest = INVESTMENT_TYPES.has(e.type);
                const canEdit = e.type === "payout";
                const canDelete = e.type === "payout" || e.type === "adjustment" || e.type === "investment";
                const prod = e.productId ? shop.products.find((p) => p.id === e.productId) : undefined;
                return (
                  <tr key={e.id} className="border-b border-zinc-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-600">
                      {new Date(e.date).toLocaleDateString()}
                      <span className="block text-xs text-zinc-500">
                        {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-900">{typeLabel[e.type] || e.type}</td>
                    <td className="px-4 py-3.5 tabular-nums text-zinc-800">{e.qty ? sqft(e.qty, prod?.unit) : "—"}</td>
                    <td
                      className={`px-4 py-3.5 tabular-nums text-base font-bold ${
                        invest ? "text-teal-800" : out ? "text-zinc-900" : "text-emerald-700"
                      }`}
                    >
                      {invest ? "" : out ? "−" : "+"}
                      {money(e.amount)}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3.5 text-sm text-zinc-600" title={e.note}>
                      {e.note || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                      <button
                        type="button"
                        className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-100"
                        onClick={() => setDetailOpen(e)}
                        aria-label="Details"
                      >
                        <Icon className="h-4 w-4">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </Icon>
                        Details
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                          onClick={() => openEdit(e)}
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                          onClick={() => onDeleteEntry(e)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {shared.length > 0 && (
        <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 sm:text-lg">
              <Icon className="h-5 w-5 text-teal-700">
                <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
              </Icon>
              Shared inventory
            </h2>
            <Link href="/inventory" className="shrink-0 text-sm font-semibold text-teal-800 hover:underline">
              Inventory →
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100 text-base">
            {shared.slice(0, 8).map((p) => {
              const pct = p.shares.find((s) => s.partnerId === id)?.percent || 0;
              return (
                <li key={p.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                  <span className="min-w-0 font-semibold text-zinc-900">
                    {p.name}
                    <span className="ml-2 font-mono text-sm font-normal text-zinc-500">{p.dimension}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sm font-medium text-zinc-700">
                    {pct}% · {sqft((pct / 100) * p.stock, p.unit)} · you {mySharePercent(p)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {entryOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={closeEntry} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <Icon className="h-5 w-5">
                  {editId ? (
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  ) : (
                    <><path d="M12 5v14" /><path d="M5 12h14" /></>
                  )}
                </Icon>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">{editId ? "Edit payout" : "Record payout"}</h2>
                <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">
                  Cash paid to {book.partner.name}. Partner capital goes through shared stock purchases.
                </p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={closeEntry}>
                <Icon className="h-5 w-5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icon>
              </button>
            </div>
            <form onSubmit={onSaveEntry} className="space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Amount (Rs)</span>
                <input
                  className="input text-base"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Note</span>
                <input
                  className="input text-base"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeEntry} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">
                  Cancel
                </button>
                <button type="submit" className="btn text-base" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Save changes" : "Add entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailOpen && (() => {
        const e = detailOpen;
        const sale = e.saleId ? shop.sales.find((s) => s.id === e.saleId) : null;
        const purchase = e.purchaseId ? shop.purchases.find((p) => p.id === e.purchaseId) : null;
        const prod = e.productId
          ? shop.products.find((p) => p.id === e.productId)
          : sale
            ? shop.products.find((p) => p.id === sale.productId)
            : purchase
              ? shop.products.find((p) => p.id === purchase.productId)
              : undefined;
        const row = (label: string, value: string) => (
          <div className="flex justify-between gap-3 border-b border-zinc-100 py-2.5 text-base last:border-0">
            <span className="font-medium text-zinc-600">{label}</span>
            <span className="text-right font-bold tabular-nums text-zinc-900">{value}</span>
          </div>
        );

        const saleBody = sale
          ? (() => {
              const allocs = sale.allocations?.length
                ? sale.allocations
                : [{ partnerId: null as string | null, qty: sale.qty }];
              const profitPer = sale.qty > 0 ? sale.profit / sale.qty : 0;
              const distributions = allocs.map((a) => {
                const partner = a.partnerId
                  ? shop.partners.find((p) => p.id === a.partnerId)
                  : null;
                const allocationProfit = a.qty * profitPer;
                const incomePercent = partner?.incomePercent ?? 100;
                const income = partner
                  ? allocationProfit * (incomePercent / 100)
                  : allocationProfit;
                return { ...a, partner, allocationProfit, incomePercent, income };
              });
              const partnerProfit = distributions
                .filter((d) => d.partner)
                .reduce((sum, d) => sum + d.income, 0);
              const ownerProfit = sale.profit - partnerProfit;
              const cust = sale.customerId
                ? shop.customers.find((c) => c.id === sale.customerId)
                : null;
              return (
                <>
                  <div className="rounded-xl border border-zinc-200 bg-white px-4 py-1">
                    {row("Date", new Date(sale.date).toLocaleString())}
                    {row("Product", prod ? productLabel(prod) : "—")}
                    {row("Customer", cust?.name || "—")}
                    {row("Qty", sqft(sale.qty, prod?.unit))}
                    {row("Unit price", money(sale.unitPrice))}
                    {row("Total", money(sale.total))}
                    {row("Cost", money(sale.costTotal))}
                    {row("Gross profit", money(sale.profit))}
                    {row(
                      "Margin",
                      `${sale.total > 0 ? ((sale.profit / sale.total) * 100).toFixed(1) : "0.0"}%`
                    )}
                    {row("This ledger credit", money(e.amount))}
                  </div>
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-700">
                      Ownership &amp; profit share
                    </h3>
                    <ul className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
                      {distributions.map((d, i) => (
                        <li
                          key={`${d.partnerId ?? "you"}-${i}`}
                          className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900">
                              {d.partner ? d.partner.name : "You"}
                            </p>
                            <p className="text-sm text-zinc-600">
                              {sqft(d.qty, prod?.unit)} ·{" "}
                              {sale.qty > 0 ? ((d.qty / sale.qty) * 100).toFixed(1) : "0"}% of sale
                              {d.partner && ` · income ${d.incomePercent}%`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold tabular-nums text-emerald-700">{money(d.income)}</p>
                            <p className="text-xs text-zinc-500">
                              profit {money(d.allocationProfit)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-between rounded-lg bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-900 ring-1 ring-teal-200">
                      <span>Your profit</span>
                      <span className="tabular-nums">{money(ownerProfit)}</span>
                    </div>
                    <div className="mt-1.5 flex justify-between px-3 text-sm font-medium text-zinc-600">
                      <span>Partners total</span>
                      <span className="tabular-nums">{money(partnerProfit)}</span>
                    </div>
                  </div>
                </>
              );
            })()
          : null;

        const purchaseBody = purchase
          ? (
              <>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-1">
                  {row("Date", new Date(purchase.date).toLocaleString())}
                  {row("Product", prod ? productLabel(prod) : "—")}
                  {row("Qty", sqft(purchase.qty, prod?.unit))}
                  {row("Unit cost", money(purchase.unitCost))}
                  {row("Total", money(purchase.total))}
                  {row("Source", purchase.tripId ? "Trip" : "Standalone")}
                  {row("Ledger amount", money(e.amount))}
                  {purchase.description ? row("Note", purchase.description) : null}
                </div>
                {prod && (prod.shares?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-700">
                      Current ownership
                    </h3>
                    <ul className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
                      <li className="flex justify-between text-sm">
                        <span className="font-semibold text-zinc-900">You</span>
                        <span className="tabular-nums text-zinc-700">{mySharePercent(prod)}%</span>
                      </li>
                      {prod.shares.map((s) => {
                        const p = shop.partners.find((x) => x.id === s.partnerId);
                        return (
                          <li key={s.partnerId} className="flex justify-between text-sm">
                            <span className="font-semibold text-zinc-900">{p?.name || "Partner"}</span>
                            <span className="tabular-nums text-zinc-700">{s.percent}%</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )
          : null;

        const genericBody = !sale && !purchase && (
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-1">
            {row("Type", typeLabel[e.type] || e.type)}
            {row("Date", new Date(e.date).toLocaleString())}
            {row("Amount", money(e.amount))}
            {e.qty ? row("Qty", sqft(e.qty, prod?.unit)) : null}
            {prod ? row("Product", productLabel(prod)) : null}
            {row("Note", e.note || "—")}
          </div>
        );

        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]"
              aria-label="Close"
              onClick={() => setDetailOpen(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-300 bg-zinc-50 shadow-xl sm:rounded-2xl"
            >
              <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-zinc-900">
                    {sale ? "Sale details" : purchase ? "Purchase details" : "Entry details"}
                  </h2>
                  <p className="mt-0.5 truncate text-base text-zinc-600">
                    {typeLabel[e.type] || e.type}
                    {prod ? ` · ${productLabel(prod)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close"
                  onClick={() => setDetailOpen(null)}
                >
                  <Icon className="h-5 w-5">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </Icon>
                </button>
              </div>
              <div className="px-4 py-5 sm:px-5">
                {saleBody}
                {purchaseBody}
                {genericBody}
                {e.type === "sale_share" && !sale && (
                  <p className="mt-3 text-sm text-amber-800">
                    Linked sale not found — it may have been deleted.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
