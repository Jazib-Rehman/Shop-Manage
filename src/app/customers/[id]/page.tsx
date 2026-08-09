"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { money, sqft } from "@/lib/calc";
import { remainingBalance } from "@/lib/payment";
import { productLabel, type PaymentStatus, type Sale } from "@/lib/types";
import { useShop } from "@/lib/store";

const statusStyle: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  partial: "bg-sky-50 text-sky-900 ring-sky-200",
  unpaid: "bg-amber-50 text-amber-900 ring-amber-200",
};

const statusLabel: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

type PayModal =
  | { mode: "add"; sale: Sale }
  | { mode: "edit"; sale: Sale; paymentId: string; amount: number; note: string };

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const shop = useShop();
  const { alert, confirm, toast } = useAlert();
  const [pay, setPay] = useState<PayModal | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const customer = shop.customers.find((c) => c.id === id);
  const sales = useMemo(
    () => shop.sales.filter((s) => s.customerId === id),
    [shop.sales, id]
  );

  const stats = useMemo(() => {
    const today = new Date(new Date().toDateString());
    let revenue = 0, paid = 0, qty = 0, overdue = 0;
    const payments: {
      saleId: string;
      paymentId: string;
      saleLabel: string;
      amount: number;
      note: string;
      paidAt: string;
      saleTotal: number;
      salePaid: number;
    }[] = [];
    for (const s of sales) {
      revenue += s.total;
      paid += s.amountPaid || 0;
      qty += s.qty;
      const due = remainingBalance(s.total, s.amountPaid || 0);
      if (due > 0 && s.dueDate && new Date(s.dueDate) < today) overdue += due;
      const p = shop.products.find((x) => x.id === s.productId);
      const label = p ? productLabel(p) : "—";
      for (const pay of s.payments || []) {
        payments.push({
          saleId: s.id,
          paymentId: pay.id,
          saleLabel: label,
          amount: pay.amount,
          note: pay.note,
          paidAt: pay.paidAt,
          saleTotal: s.total,
          salePaid: s.amountPaid || 0,
        });
      }
    }
    payments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    const due = Math.max(0, revenue - paid) + Math.max(0, customer?.arrears || 0);
    const last = sales.length
      ? sales.reduce((m, s) => (s.date > m ? s.date : m), sales[0].date)
      : null;
    return {
      revenue,
      paid,
      due,
      salesDue: Math.max(0, revenue - paid),
      arrears: Math.max(0, customer?.arrears || 0),
      qty,
      overdue,
      payments,
      last,
    };
  }, [sales, shop.products, customer?.arrears]);

  const openAdd = (sale: Sale) => {
    const due = remainingBalance(sale.total, sale.amountPaid || 0);
    setPay({ mode: "add", sale });
    setAmount(String(due));
    setNote("");
  };

  const openEdit = (row: (typeof stats.payments)[number]) => {
    const sale = sales.find((s) => s.id === row.saleId);
    if (!sale) return;
    setPay({ mode: "edit", sale, paymentId: row.paymentId, amount: row.amount, note: row.note });
    setAmount(String(row.amount));
    setNote(row.note || "");
  };

  const maxPay = pay
    ? pay.mode === "add"
      ? remainingBalance(pay.sale.total, pay.sale.amountPaid || 0)
      : remainingBalance(pay.sale.total, (pay.sale.amountPaid || 0) - pay.amount) + pay.amount
    : 0;

  const onPaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pay) return;
    const amt = Number(amount);
    if (!(amt > 0)) return;
    setSaving(true);
    try {
      if (pay.mode === "add") {
        await shop.addSalePayment(pay.sale.id, amt, note.trim());
      } else {
        await shop.updateSalePayment(pay.sale.id, pay.paymentId, amt, note.trim());
      }
      setPay(null);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDeletePayment = async (row: (typeof stats.payments)[number]) => {
    if (!(await confirm(`Delete payment of ${money(row.amount)}?`))) return;
    try {
      await shop.deleteSalePayment(row.saleId, row.paymentId);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const unpaidSales = sales.filter((s) => remainingBalance(s.total, s.amountPaid || 0) > 0);

  const onSettleAll = async () => {
    if (!unpaidSales.length) return;
    setSaving(true);
    try {
      for (const s of unpaidSales) await shop.markSalePaid(s.id, { quiet: true });
      setSettleOpen(false);
      toast("All dues settled", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Settle failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;
  if (!customer) {
    return (
      <div className="space-y-3">
        <p className="text-zinc-600">Customer not found.</p>
        <Link href="/customers" className="font-semibold text-teal-800 underline">Back to customers</Link>
      </div>
    );
  }

  const hero = [
    { label: "Total business", value: money(stats.revenue), tone: "text-zinc-900" },
    { label: "Received", value: money(stats.paid), tone: "text-emerald-700" },
    { label: "Outstanding", value: money(stats.due), tone: stats.due > 0 ? "text-amber-700" : "text-zinc-400" },
    { label: "Prior arrears", value: money(stats.arrears), tone: stats.arrears > 0 ? "text-amber-700" : "text-zinc-400" },
  ];

  const secondary = [
    { label: "Sales", value: String(sales.length) },
    { label: "Quantity", value: sqft(stats.qty) },
    { label: "Avg sale", value: money(sales.length ? stats.revenue / sales.length : 0) },
    { label: "Last sale", value: stats.last ? new Date(stats.last).toLocaleDateString() : "—" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
          Customers
        </Link>
        <div className="mt-3 flex min-w-0 items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-xl font-bold text-white">
            {customer.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{customer.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">{customer.phone || "No phone"}</p>
          </div>
          {unpaidSales.length > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setSettleOpen(true)}
              className="ml-auto shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Settle all · {money(stats.salesDue)}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
        {hero.map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">{c.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
        {secondary.map((c) => (
          <div key={c.label} className="rounded-xl bg-zinc-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-0.5 font-bold tabular-nums text-zinc-900">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white shadow-sm">
        <h2 className="border-b border-zinc-200 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-700 sm:px-5">
          Sales history · {sales.length}
        </h2>
        {sales.length === 0 ? (
          <p className="px-4 py-10 text-center text-zinc-600">No sales yet</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sales.map((s) => {
              const p = shop.products.find((x) => x.id === s.productId);
              const due = remainingBalance(s.total, s.amountPaid || 0);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900">{p ? productLabel(p) : "—"}</p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      {new Date(s.date).toLocaleDateString()} · {sqft(s.qty, p?.unit)} @ {money(s.unitPrice)}
                      {s.dueDate && due > 0 && ` · due by ${new Date(s.dueDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-zinc-900">{money(s.total)}</p>
                      {due > 0 && <p className="text-sm font-semibold tabular-nums text-amber-800">due {money(due)}</p>}
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyle[s.paymentStatus]}`}>
                      {statusLabel[s.paymentStatus]}
                    </span>
                    {due > 0 && (
                      <button
                        type="button"
                        onClick={() => openAdd(s)}
                        className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white shadow-sm">
        <h2 className="border-b border-zinc-200 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-700 sm:px-5">
          Payments received · {stats.payments.length}
        </h2>
        {stats.payments.length === 0 ? (
          <p className="px-4 py-10 text-center text-zinc-600">No payments recorded</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {stats.payments.map((p) => (
              <li key={p.paymentId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-800">{p.saleLabel}</p>
                  <p className="text-sm text-zinc-500">
                    {new Date(p.paidAt).toLocaleDateString()}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold tabular-nums text-emerald-700">{money(p.amount)}</p>
                  <button type="button" className="rounded-md px-2 py-1 text-sm font-semibold text-teal-800 hover:bg-teal-50" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button type="button" className="rounded-md px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => onDeletePayment(p)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settleOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50" aria-label="Close" onClick={() => !saving && setSettleOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">Settle all dues?</h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                {customer.name} · {unpaidSales.length} sale{unpaidSales.length === 1 ? "" : "s"} · {money(stats.salesDue)}
              </p>
            </div>
            <ul className="max-h-48 divide-y divide-zinc-100 overflow-y-auto px-5">
              {unpaidSales.map((s) => {
                const p = shop.products.find((x) => x.id === s.productId);
                const due = remainingBalance(s.total, s.amountPaid || 0);
                return (
                  <li key={s.id} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-zinc-700">{p ? productLabel(p) : "—"}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-amber-800">{money(due)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setSettleOpen(false)} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={saving} onClick={onSettleAll} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {saving ? "Settling…" : `Confirm settle · ${money(stats.salesDue)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50" aria-label="Close" onClick={() => setPay(null)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900">{pay.mode === "add" ? "Record payment" : "Edit payment"}</h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                {productLabel(shop.products.find((x) => x.id === pay.sale.productId) || { name: "Sale", dimension: "" })} · max {money(maxPay)}
              </p>
            </div>
            <form onSubmit={onPaySubmit} className="space-y-4 px-5 py-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Amount (Rs)</span>
                <input
                  className="input text-base"
                  type="number"
                  min="0.01"
                  max={maxPay}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Note</span>
                <input className="input text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cash, bank, installment…" />
              </label>
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPay(null)} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</button>
                <button type="submit" className="btn text-base" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
