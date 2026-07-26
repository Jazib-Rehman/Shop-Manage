"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { ProductSearchSelect } from "@/components/ProductSearchSelect";
import { CustomerSelect } from "@/components/CustomerSelect";
import { money, sqft } from "@/lib/calc";
import {
  allocDisplay,
  allocFromInput,
  defaultAllocations,
  type AllocUnit,
  type SaleAllocation,
} from "@/lib/allocations";
import { remainingBalance } from "@/lib/payment";
import type { PaymentStatus, Sale } from "@/lib/types";
import { mySharePercent, productLabel } from "@/lib/types";
import { useShop } from "@/lib/store";

function dueInput(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const statusStyle: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-800",
  partial: "bg-sky-50 text-sky-900",
  unpaid: "bg-amber-50 text-amber-900",
};

const statusLabel: Record<PaymentStatus, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

export default function SalesPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [origQty, setOrigQty] = useState(0);
  const [origProductId, setOrigProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [description, setDescription] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [amountPaidNow, setAmountPaidNow] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [allocations, setAllocations] = useState<SaleAllocation[]>([]);
  const [allocUnit, setAllocUnit] = useState<AllocUnit>("sqft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [fName, setFName] = useState("");
  const [fSize, setFSize] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fStatus, setFStatus] = useState<"all" | PaymentStatus | "overdue">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!open && !payOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPayOpen(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, payOpen]);

  const { products, sales, customers } = shop;
  const rows = useMemo(() => {
    const today = new Date(new Date().toDateString());
    return sales.filter((r) => {
      const prod = products.find((x) => x.id === r.productId);
      if (fName && prod?.name !== fName) return false;
      if (fSize && prod?.dimension !== fSize) return false;
      if (fCustomer && (r.customerId || "") !== fCustomer) return false;
      if (fStatus === "overdue") {
        if (
          r.paymentStatus === "paid" ||
          !r.dueDate ||
          new Date(r.dueDate) >= today
        )
          return false;
      } else if (fStatus !== "all" && r.paymentStatus !== fStatus) {
        return false;
      }
      if (fFrom && r.date.slice(0, 10) < fFrom) return false;
      if (fTo && r.date.slice(0, 10) > fTo) return false;
      if (fSearch) {
        const cust = customers.find((c) => c.id === r.customerId)?.name || "";
        const hay = `${prod ? productLabel(prod) : ""} ${cust} ${r.description}`.toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [sales, products, customers, fName, fSize, fCustomer, fStatus, fFrom, fTo, fSearch]);

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const reset = () => {
    setEditId(null);
    setOrigQty(0);
    setOrigProductId("");
    setProductId("");
    setQty("1");
    setUnitPrice("");
    setDescription("");
    setPaymentStatus("paid");
    setAmountPaidNow("");
    setCustomerId("");
    setDueDate("");
    setAllocations([]);
    setAllocUnit("sqft");
    setError("");
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (r: Sale) => {
    setEditId(r.id);
    setOrigQty(r.qty);
    setOrigProductId(r.productId);
    setProductId(r.productId);
    setQty(String(r.qty));
    setUnitPrice(String(r.unitPrice));
    setDescription(r.description || "");
    setPaymentStatus(r.paymentStatus || "paid");
    setAmountPaidNow(String(r.amountPaid || 0));
    setCustomerId(r.customerId || "");
    setDueDate(dueInput(r.dueDate));
    setAllocations(
      r.allocations?.length
        ? (() => {
            const p = shop.products.find((x) => x.id === r.productId);
            const allowed = new Set(
              (p?.shares ?? []).filter((s) => s.percent > 0).map((s) => s.partnerId)
            );
            const mine = p ? mySharePercent(p) > 0 : true;
            return r.allocations
              .filter((a) => (a.partnerId ? allowed.has(a.partnerId) : mine))
              .map((a) => ({ partnerId: a.partnerId, qty: a.qty }));
          })()
        : []
    );
    setError("");
    setOpen(true);
  };

  const openPay = (r: Sale) => {
    const due = remainingBalance(r.total, r.amountPaid || 0);
    setPayOpen(r);
    setPayAmount(String(due));
    setPayNote("");
  };

  const onProduct = (id: string) => {
    setProductId(id);
    const p = shop.products.find((x) => x.id === id);
    if (p && !editId) {
      setUnitPrice(String(p.sellPrice || 0));
      setAllocations(defaultAllocations(Number(qty) || 0, p));
    }
    setError("");
  };

  const syncAllocations = (nextQty: number, pid = productId) => {
    const p = shop.products.find((x) => x.id === pid);
    if (!p?.shares?.length) {
      setAllocations([{ partnerId: null, qty: nextQty }]);
      return;
    }
    setAllocations(defaultAllocations(nextQty, p));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    const price = Number(unitPrice);
    if (!productId || q <= 0 || price < 0) return;
    if (!editId && q > available) {
      setError(`Only ${sqft(available)} available`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.saveSale({
        id: editId ?? undefined,
        productId,
        qty: q,
        unitPrice: price,
        description,
        paymentStatus,
        amountPaid: paymentStatus === "partial" ? Number(amountPaidNow) || 0 : undefined,
        customerId: customerId || null,
        dueDate: paymentStatus !== "paid" && dueDate ? dueDate : null,
        allocations:
          selected?.shares?.length
            ? allocations.length > 1
              ? allocations
              : defaultAllocations(q, selected)
            : undefined,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onPaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payOpen) return;
    const amount = Number(payAmount);
    setSaving(true);
    try {
      await shop.addSalePayment(payOpen.id, amount, payNote);
      setPayOpen(null);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (r: Sale) => {
    if (!(await confirm(`Delete sale of ${sqft(r.qty)}?`))) return;
    try {
      await shop.deleteSale(r.id);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onMarkPaid = async (r: Sale) => {
    const due = remainingBalance(r.total, r.amountPaid || 0);
    if (!(await confirm(`Settle remaining ${money(due)}?`))) return;
    try {
      await shop.markSalePaid(r.id);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const nameOf = (id: string) => {
    const p = shop.products.find((x) => x.id === id);
    return p ? productLabel(p) : "—";
  };
  const customerOf = (id: string | null) => {
    if (!id) return "—";
    const c = shop.customers.find((x) => x.id === id);
    return c ? c.name : "—";
  };

  const selected = shop.products.find((p) => p.id === productId);
  const qNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0;
  const unitCost = selected?.costPrice ?? 0;
  const revenue = qNum * priceNum;
  const cogs = qNum * unitCost;
  const profit = revenue - cogs;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const available =
    selected && editId && productId === origProductId
      ? selected.stock + origQty
      : selected?.stock ?? 0;
  const stockAfter = available - qNum;
  const outstanding = shop.sales.filter((s) => s.paymentStatus !== "paid");
  const paidNowNum =
    paymentStatus === "paid"
      ? revenue
      : paymentStatus === "partial"
        ? Math.min(Number(amountPaidNow) || 0, revenue)
        : 0;

  const productOf = (id: string) => shop.products.find((x) => x.id === id);
  const names = [...new Set(shop.products.map((p) => p.name))].sort();
  const sizes = [...new Set(shop.products.map((p) => p.dimension))].sort();
  const activeFilters = [fName, fSize, fCustomer, fStatus !== "all", fFrom, fTo, fSearch].filter(Boolean).length;
  const clearFilters = () => {
    setFName("");
    setFSize("");
    setFCustomer("");
    setFStatus("all");
    setFFrom("");
    setFTo("");
    setFSearch("");
  };
  const totalRev = rows.reduce((s, r) => s + r.total, 0);
  const totalDue = rows.reduce((s, r) => s + remainingBalance(r.total, r.amountPaid || 0), 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
              <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Sales</h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              {rows.length} of {shop.sales.length} · {money(totalRev)}
              {totalDue > 0 && <> · due {money(totalDue)}</>}
            </p>
          </div>
        </div>
        <button type="button" className="btn w-full justify-center text-base sm:w-auto" disabled={!shop.products.length} onClick={openCreate}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 h-5 w-5" aria-hidden>
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          New sale
        </button>
      </div>

      {outstanding.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-base text-amber-950">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-amber-700" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
          <span>
            <span className="font-bold">{outstanding.length} open</span>
            {" · "}Due {money(outstanding.reduce((s, x) => s + remainingBalance(x.total, x.amountPaid || 0), 0))}
          </span>
        </div>
      )}

      <div className="min-w-0 rounded-2xl border border-zinc-300 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filters
          </p>
          <div className="flex items-center gap-3">
            {activeFilters > 0 && (
              <button type="button" className="text-sm font-semibold text-teal-800 hover:underline" onClick={clearFilters}>
                Clear ({activeFilters})
              </button>
            )}
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 sm:hidden"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 bg-zinc-50/80 p-3 sm:grid sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7`}>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
              </svg>
              Marble
            </span>
            <select className="input text-base" value={fName} onChange={(e) => setFName(e.target.value)}>
              <option value="">All marbles</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
              </svg>
              Size
            </span>
            <select className="input text-base" value={fSize} onChange={(e) => setFSize(e.target.value)}>
              <option value="">All sizes</option>
              {sizes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              </svg>
              Customer
            </span>
            <select className="input text-base" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)}>
              <option value="">All customers</option>
              {shop.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Status
            </span>
            <select className="input text-base" value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)}>
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
              </svg>
              From date
            </span>
            <input className="input text-base" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
              </svg>
              To date
            </span>
            <input className="input text-base" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              Search
            </span>
            <input className="input text-base" placeholder="Marble, customer…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
            {shop.sales.length === 0 ? "No sales yet" : "No matches"}
          </div>
        )}
        {rows.map((r) => {
          const due = remainingBalance(r.total, r.amountPaid || 0);
          const overdue =
            r.paymentStatus !== "paid" &&
            r.dueDate &&
            new Date(r.dueDate) < new Date(new Date().toDateString());
          const prod = productOf(r.productId);
          return (
            <article key={r.id} className="min-w-0 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-zinc-900">{prod?.name ?? nameOf(r.productId)}</p>
                  {prod && <p className="font-mono text-sm text-zinc-500">{prod.dimension}</p>}
                  <p className="mt-1 text-sm text-zinc-600">
                    {new Date(r.date).toLocaleDateString()} · {customerOf(r.customerId)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg tabular-nums font-bold text-zinc-900">{money(r.total)}</p>
                  <span className={`mt-1 inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${statusStyle[r.paymentStatus]}`}>
                    {statusLabel[r.paymentStatus]}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">Paid</p>
                  <p className="font-semibold tabular-nums text-zinc-800">{money(r.amountPaid || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-zinc-500">Due</p>
                  <p className={`font-semibold tabular-nums ${due > 0 ? "text-amber-800" : "text-zinc-400"}`}>{money(due)}</p>
                  {r.dueDate && r.paymentStatus !== "paid" && (
                    <p className={`text-xs font-medium ${overdue ? "text-red-700" : "text-zinc-500"}`}>
                      by {new Date(r.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                {r.paymentStatus !== "paid" && (
                  <>
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-200"
                      onClick={() => openPay(r)}
                    >
                      Pay
                    </button>
                    <button
                      type="button"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200"
                      onClick={() => onMarkPaid(r)}
                    >
                      Settle
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                  onClick={() => onDelete(r)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
            <tr>
              <th className="px-4 py-3.5">Date</th>
              <th className="px-4 py-3.5">Marble</th>
              <th className="px-4 py-3.5">Customer</th>
              <th className="px-4 py-3.5">Total</th>
              <th className="px-4 py-3.5">Paid</th>
              <th className="px-4 py-3.5">Due</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-600">
                  {shop.sales.length === 0 ? "No sales yet" : "No matches"}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const due = remainingBalance(r.total, r.amountPaid || 0);
              const overdue =
                r.paymentStatus !== "paid" &&
                r.dueDate &&
                new Date(r.dueDate) < new Date(new Date().toDateString());
              const prod = productOf(r.productId);
              return (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-600">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-zinc-900">{prod?.name ?? nameOf(r.productId)}</p>
                    {prod && <p className="mt-0.5 font-mono text-sm text-zinc-500">{prod.dimension}</p>}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-zinc-800">{customerOf(r.customerId)}</td>
                  <td className="px-4 py-3.5 tabular-nums font-bold text-zinc-900">{money(r.total)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-zinc-800">{money(r.amountPaid || 0)}</td>
                  <td className={`px-4 py-3.5 tabular-nums font-semibold ${due > 0 ? "text-amber-800" : "text-zinc-400"}`}>
                    {money(due)}
                    {r.dueDate && r.paymentStatus !== "paid" && (
                      <span className={`mt-0.5 block text-sm font-medium ${overdue ? "text-red-700" : "text-zinc-500"}`}>
                        by {new Date(r.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-semibold ${statusStyle[r.paymentStatus]}`}>
                      {statusLabel[r.paymentStatus]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                    {r.paymentStatus !== "paid" && (
                      <>
                        <button
                          type="button"
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-sky-800 hover:bg-sky-50"
                          onClick={() => openPay(r)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                          Pay
                        </button>
                        <button
                          type="button"
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50"
                          onClick={() => onMarkPaid(r)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          Settle
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                      onClick={() => openEdit(r)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => onDelete(r)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={close} />
          <div role="dialog" aria-modal="true" className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  {editId ? (
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  ) : (
                    <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>
                  )}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">{editId ? "Edit sale" : "New sale"}</h2>
                <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">Stock updates now · payment can be split</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={close}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
              {!editId && (
                <>
                  <label className="block space-y-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                        <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
                      </svg>
                      Marble · size
                    </span>
                    <ProductSearchSelect products={shop.products.filter((p) => p.stock > 0)} value={productId} onChange={onProduct} placeholder="Select marble · size…" />
                    {selected && <span className="text-sm text-zinc-600">{sqft(available)} available</span>}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                        </svg>
                        Qty (sq ft)
                      </span>
                      <input
                        className="input text-base"
                        type="number"
                        min="0.01"
                        max={available || undefined}
                        step="0.01"
                        value={qty}
                        onChange={(e) => {
                          const n = Math.min(Number(e.target.value) || 0, available || 0);
                          setQty(e.target.value === "" ? "" : String(n));
                          syncAllocations(n);
                        }}
                        required
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                          <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        Price / ft
                      </span>
                      <input className="input text-base" type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
                    </label>
                  </div>

                  {allocations.length > 1 && (
                    <fieldset className="space-y-3 rounded-xl border border-zinc-300 bg-zinc-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <legend className="flex items-center gap-1.5 px-1 text-sm font-bold text-zinc-800">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Sold from whose share?
                        </legend>
                        <div className="flex gap-1.5">
                          {([["percent", "%"], ["sqft", "sq ft"], ["amount", "Rs"]] as const).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setAllocUnit(key)}
                              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                                allocUnit === key ? "bg-teal-700 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-300"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-600">Defaults to ownership %. Sum must equal qty.</p>
                      {allocations.map((a, i) => {
                        const label = a.partnerId
                          ? shop.partners.find((p) => p.id === a.partnerId)?.name || "Partner"
                          : "You";
                        const display = allocDisplay(a.qty, allocUnit, qNum, priceNum);
                        return (
                          <label key={`${a.partnerId ?? "me"}-${i}`} className="flex items-center gap-2.5">
                            <span className="w-28 shrink-0 text-base font-semibold text-zinc-800">{label}</span>
                            <input
                              className="input text-base"
                              type="number"
                              min="0"
                              step="0.01"
                              value={Number(display.toFixed(2))}
                              onChange={(e) => {
                                const next = [...allocations];
                                next[i] = {
                                  ...next[i],
                                  qty: allocFromInput(Number(e.target.value) || 0, allocUnit, qNum, priceNum),
                                };
                                setAllocations(next);
                              }}
                            />
                            <span className="shrink-0 tabular-nums text-sm font-medium text-zinc-600">
                              {allocUnit !== "sqft" && `${sqft(a.qty)} · `}
                              {money(a.qty * priceNum)}
                            </span>
                          </label>
                        );
                      })}
                      <p className={`text-sm font-semibold ${Math.abs(allocations.reduce((s, a) => s + a.qty, 0) - qNum) > 0.02 ? "text-red-700" : "text-zinc-600"}`}>
                        Allocated {sqft(allocations.reduce((s, a) => s + a.qty, 0))} / {sqft(qNum)}
                      </p>
                    </fieldset>
                  )}
                </>
              )}

              {editId && (
                <p className="rounded-xl bg-zinc-50 px-4 py-3 text-base font-semibold text-zinc-800 ring-1 ring-zinc-200">
                  {nameOf(productId)} · {sqft(qNum)} · {money(revenue)}
                </p>
              )}

              <fieldset className="space-y-3">
                <legend className="flex items-center gap-1.5 text-sm font-bold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                  </svg>
                  Payment
                </legend>
                {!editId && (
                  <div className="grid grid-cols-3 gap-2">
                    {([["paid", "Paid full"], ["partial", "Partial"], ["unpaid", "Unpaid"]] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentStatus(key)}
                        className={`rounded-lg border px-2 py-2.5 text-sm font-semibold ${
                          paymentStatus === key
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {!editId && paymentStatus === "partial" && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-zinc-800">Amount paid now</span>
                    <input
                      className="input text-base"
                      type="number"
                      min="0.01"
                      max={revenue || undefined}
                      step="0.01"
                      value={amountPaidNow}
                      onChange={(e) => setAmountPaidNow(e.target.value)}
                      required
                    />
                    <span className="text-sm text-zinc-600">
                      Remaining {money(Math.max(0, revenue - (Number(amountPaidNow) || 0)))}
                    </span>
                  </label>
                )}
                {paymentStatus !== "paid" && (
                  <div className="space-y-3">
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                        </svg>
                        Customer
                      </span>
                      <CustomerSelect
                        customers={shop.customers}
                        value={customerId}
                        onChange={setCustomerId}
                        onCreated={shop.addCustomerLocal}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
                        </svg>
                        Due date
                      </span>
                      <input className="input text-base" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </label>
                  </div>
                )}
              </fieldset>

              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" /><path d="M14 2v6h6" />
                  </svg>
                  Description
                </span>
                <textarea className="input min-h-[72px] resize-y text-base" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              {!editId && (
                <div className="rounded-xl bg-teal-50/60 px-4 py-3.5 ring-1 ring-teal-200/80">
                  <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-teal-900">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                      <path d="M9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Summary
                  </p>
                  <dl className="space-y-2 text-base">
                    <div className="flex justify-between gap-4"><dt className="text-zinc-700">Total</dt><dd className="font-semibold tabular-nums text-zinc-900">{money(revenue)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-zinc-700">Paid now</dt><dd className="font-semibold tabular-nums text-zinc-900">{money(paidNowNum)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-zinc-700">Balance due</dt><dd className="font-semibold tabular-nums text-zinc-900">{money(Math.max(0, revenue - paidNowNum))}</dd></div>
                    <div className="flex justify-between gap-4 border-t border-teal-200/80 pt-2"><dt className="font-bold text-zinc-900">Gross profit</dt><dd className="text-lg font-bold tabular-nums text-emerald-700">{money(profit)}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-zinc-700">Margin</dt><dd className="font-semibold tabular-nums text-zinc-900">{margin.toFixed(1)}%</dd></div>
                    {selected && <div className="flex justify-between gap-4"><dt className="text-zinc-700">Stock after</dt><dd className="font-semibold tabular-nums text-zinc-900">{sqft(Math.max(0, stockAfter))}</dd></div>}
                  </dl>
                </div>
              )}

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">{error}</p>}

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</button>
                <button type="submit" className="btn text-base" disabled={saving || (!editId && !productId)}>
                  {saving ? "Saving…" : editId ? "Save changes" : "Record sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={() => setPayOpen(null)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900">Add payment</h2>
                <p className="mt-0.5 text-base text-zinc-600">
                  {payOpen.customerId ? customerOf(payOpen.customerId) : "Customer"} · due{" "}
                  {money(remainingBalance(payOpen.total, payOpen.amountPaid || 0))}
                </p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={() => setPayOpen(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={onPaySubmit} className="space-y-4 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Amount (Rs)</span>
                <input
                  className="input text-base"
                  type="number"
                  min="0.01"
                  max={remainingBalance(payOpen.total, payOpen.amountPaid || 0)}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-zinc-800">Note</span>
                <input className="input text-base" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Installment 2, cash, etc." />
              </label>
              {payOpen.payments.length > 0 && (
                <ul className="max-h-32 space-y-1.5 overflow-auto rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700 ring-1 ring-zinc-200">
                  {payOpen.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>{new Date(p.paidAt).toLocaleDateString()}{p.note ? ` · ${p.note}` : ""}</span>
                      <span className="tabular-nums font-semibold">{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPayOpen(null)} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</button>
                <button type="submit" className="btn text-base" disabled={saving}>{saving ? "Saving…" : "Record payment"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
