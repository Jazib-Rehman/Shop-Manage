"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { money, sqft } from "@/lib/calc";
import { freightPerSqFt, freightShare, lineTons, ratePerTon } from "@/lib/freight";
import { useShop } from "@/lib/store";
import type { Purchase, Trip } from "@/lib/types";
import { productLabel } from "@/lib/types";

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function PurchaseSearchSelect({
  purchases,
  selectedIds,
  onToggle,
  onSetAll,
  products,
}: {
  purchases: Purchase[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSetAll: (ids: string[], on: boolean) => void;
  products: { id: string; name: string; dimension: string; sqFtPerTon?: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const metaOf = (p: Purchase) => {
    const prod = products.find((x) => x.id === p.productId);
    return {
      name: prod ? productLabel(prod) : "—",
      qty: sqft(p.qty),
      rate: money(p.unitCost),
      total: money(p.total),
    };
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return purchases;
    return purchases.filter((p) => {
      const m = metaOf(p);
      return `${m.name} ${m.qty} ${m.rate}`.toLowerCase().includes(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases, q, products]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="input flex w-full items-center justify-between text-left text-base"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-zinc-600">
          {selectedIds.length ? `${selectedIds.length} selected — add more…` : "Add purchase…"}
        </span>
        <span className="ml-2 shrink-0 text-zinc-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-300 bg-white shadow-lg">
          <input
            className="input sticky top-0 rounded-none border-0 border-b border-zinc-200 text-base"
            placeholder="Marble, size, qty…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-sm text-zinc-500">No matching purchases</p>
          )}
          {filtered.length > 0 &&
            (() => {
              const allOn = filtered.every((p) => selectedIds.includes(p.id));
              return (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 border-b border-zinc-200 px-3 py-2.5 text-left text-sm font-semibold text-teal-800 hover:bg-zinc-50"
                  onClick={() =>
                    onSetAll(
                      filtered.map((p) => p.id),
                      !allOn
                    )
                  }
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      allOn
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-zinc-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {allOn ? "Deselect all" : "Select all"} ({filtered.length})
                </button>
              );
            })()}
          {filtered.map((p) => {
            const m = metaOf(p);
            const on = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50 ${
                  on ? "bg-teal-50/70" : ""
                }`}
                onClick={() => onToggle(p.id)}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    on
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-zinc-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-zinc-900">{m.name}</span>
                  <span className="mt-0.5 block text-sm tabular-nums text-zinc-600">
                    {m.qty} · {m.rate}/ft
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold tabular-nums text-zinc-800">{m.total}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TripsPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [truckFare, setTruckFare] = useState("");
  const [loadingCost, setLoadingCost] = useState("");
  const [unloadingCost, setUnloadingCost] = useState("");
  const [purchaseIds, setPurchaseIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fName, setFName] = useState("");
  const [fSize, setFSize] = useState("");
  const [fExp, setFExp] = useState<"all" | "with" | "none">("all");
  const [fSearch, setFSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      setTrips(await api("/api/trips"));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const freePurchases = useMemo(
    () => shop.purchases.filter((p) => !p.tripId),
    [shop.purchases]
  );

  const reset = () => {
    setEditId(null);
    setNote("");
    setTruckFare("");
    setLoadingCost("");
    setUnloadingCost("");
    setPurchaseIds([]);
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

  const openEdit = (t: Trip) => {
    reset();
    setEditId(t.id);
    setNote(t.note);
    setTruckFare(t.truckFare ? String(t.truckFare) : "");
    setLoadingCost(t.loadingCost ? String(t.loadingCost) : "");
    setUnloadingCost(t.unloadingCost ? String(t.unloadingCost) : "");
    setOpen(true);
  };

  const selectedPurchases = purchaseIds
    .map((id) => freePurchases.find((p) => p.id === id))
    .filter(Boolean) as Purchase[];
  const perTon = ratePerTon(Number(truckFare), Number(loadingCost), Number(unloadingCost));
  const weightOf = (productId: string) =>
    shop.products.find((p) => p.id === productId)?.sqFtPerTon || 0;
  const editLines = editId ? trips.find((t) => t.id === editId)?.lines ?? [] : [];
  const previewLines = editId ? editLines : selectedPurchases;
  const totalTons = previewLines.reduce(
    (sum, p) => sum + lineTons(p.qty, weightOf(p.productId)),
    0
  );
  const expensesTotal = perTon * totalTons;
  const freightPerFtSel = (p: Purchase) =>
    freightPerSqFt(perTon, weightOf(p.productId));
  const marbleTotal = previewLines.reduce((s, p) => s + p.total, 0);
  const landedTotal = marbleTotal + expensesTotal;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (editId) {
      setSaving(true);
      try {
        await api(`/api/trips/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note, truckFare, loadingCost, unloadingCost }),
        });
        await Promise.all([loadTrips(), shop.refresh()]);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    const ids = purchaseIds.filter(Boolean);
    if (!ids.length) {
      setError("Add at least one purchase");
      return;
    }

    setSaving(true);
    try {
      await api("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, truckFare, loadingCost, unloadingCost, purchaseIds: ids }),
      });
      await Promise.all([loadTrips(), shop.refresh()]);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (t: Trip) => {
    if (!(await confirm(`Delete this trip? Purchases stay — only freight is removed.`))) return;
    try {
      await api(`/api/trips/${t.id}`, { method: "DELETE" });
      await Promise.all([loadTrips(), shop.refresh()]);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const nameOf = (id: string) => {
    const p = shop.products.find((x) => x.id === id);
    return p ? productLabel(p) : "—";
  };

  const landedOf = (t: Trip) =>
    t.lines.reduce((s, l) => s + l.total, 0) + t.expensesTotal;
  const qtyOf = (t: Trip) => t.lines.reduce((s, l) => s + l.qty, 0);
  const itemCountOf = (t: Trip) =>
    new Set(t.lines.map((l) => l.productId)).size;
  const totalTonsOf = (t: Trip) =>
    t.lines.reduce((sum, l) => sum + lineTons(l.qty, weightOf(l.productId)), 0);
  /** Same product → one line (qty summed, weighted avg price). */
  const mergedLinesOf = (t: Trip) => {
    const map = new Map<
      string,
      { productId: string; qty: number; costSum: number }
    >();
    for (const l of t.lines) {
      const cur = map.get(l.productId) ?? { productId: l.productId, qty: 0, costSum: 0 };
      cur.qty += l.qty;
      cur.costSum += l.unitCost * l.qty;
      map.set(l.productId, cur);
    }
    return [...map.values()].map((m) => ({
      productId: m.productId,
      qty: m.qty,
      unitCost: m.qty > 0 ? m.costSum / m.qty : 0,
      total: m.costSum,
    }));
  };

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const names = [...new Set(shop.products.map((p) => p.name))].sort();
  const sizes = [...new Set(shop.products.map((p) => p.dimension))].sort();
  const productOf = (id: string) => shop.products.find((x) => x.id === id);

  const rows = trips.filter((t) => {
    if (fFrom && t.date.slice(0, 10) < fFrom) return false;
    if (fTo && t.date.slice(0, 10) > fTo) return false;
    if (fExp === "with" && t.expensesTotal <= 0) return false;
    if (fExp === "none" && t.expensesTotal > 0) return false;
    if (fName || fSize) {
      const match = t.lines.some((l) => {
        const p = productOf(l.productId);
        if (fName && p?.name !== fName) return false;
        if (fSize && p?.dimension !== fSize) return false;
        return true;
      });
      if (!match) return false;
    }
    if (fSearch) {
      const hay = `${t.note} ${t.lines.map((l) => nameOf(l.productId)).join(" ")}`.toLowerCase();
      if (!hay.includes(fSearch.toLowerCase())) return false;
    }
    return true;
  });
  const activeFilters = [fFrom, fTo, fName, fSize, fExp !== "all", fSearch].filter(Boolean).length;
  const clearFilters = () => {
    setFFrom("");
    setFTo("");
    setFName("");
    setFSize("");
    setFExp("all");
    setFSearch("");
  };
  const totalExp = rows.reduce((s, t) => s + t.expensesTotal, 0);
  const totalLanded = rows.reduce((s, t) => s + landedOf(t), 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
              <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-4l-3-4h-5v8h2" />
              <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Trips</h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              {rows.length} of {trips.length} · exp {money(totalExp)} · landed {money(totalLanded)}
            </p>
          </div>
        </div>
        <button type="button" className="btn w-full justify-center text-base sm:w-auto" disabled={!freePurchases.length} onClick={openCreate}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 h-5 w-5" aria-hidden>
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          New trip
        </button>
      </div>

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
        <div className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 bg-zinc-50/80 p-3 sm:grid sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-6`}>
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
                <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Expenses
            </span>
            <select className="input text-base" value={fExp} onChange={(e) => setFExp(e.target.value as typeof fExp)}>
              <option value="all">All trips</option>
              <option value="with">With expenses</option>
              <option value="none">No expenses</option>
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
            <input className="input text-base" placeholder="Note or marble…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">Loading…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
            {trips.length === 0 ? "No trips yet" : "No matches"}
          </div>
        )}
        {!loading &&
          rows.map((t) => {
            const qy = qtyOf(t);
            const isOpen = expanded === t.id;
            return (
              <article key={t.id} className="min-w-0 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-600">{new Date(t.date).toLocaleDateString()}</p>
                    <p className="mt-0.5 truncate font-bold text-zinc-900">{t.note || "Untitled trip"}</p>
                    <p className="mt-1 text-sm text-zinc-600">{itemCountOf(t)} items · {sqft(qy)}</p>
                  </div>
                  <p className="shrink-0 text-right text-lg tabular-nums font-bold text-zinc-900">{money(landedOf(t))}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Expenses</p>
                    <p className="font-semibold tabular-nums text-zinc-800">{money(t.expensesTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-500">Landed</p>
                    <p className="font-bold tabular-nums text-zinc-900">{money(landedOf(t))}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                  >
                    {isOpen ? "Hide lines" : "Lines"}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${isOpen ? "rotate-180" : ""}`} aria-hidden>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200"
                    onClick={() => openEdit(t)}
                  >
                    Edit costs
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
                    onClick={() => onDelete(t)}
                  >
                    Delete
                  </button>
                </div>
                {isOpen && (
                  <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                    {mergedLinesOf(t).map((l) => {
                      const tons = lineTons(l.qty, weightOf(l.productId));
                      const perTonRate = ratePerTon(t.truckFare, t.loadingCost, t.unloadingCost);
                      const freightTotal = freightShare(perTonRate, tons);
                      const freightFt = freightPerSqFt(perTonRate, weightOf(l.productId));
                      const prod = productOf(l.productId);
                      return (
                        <li key={l.productId} className="rounded-lg bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-900">{prod?.name ?? nameOf(l.productId)}</p>
                              {prod && <p className="font-mono text-xs text-zinc-500">{prod.dimension}</p>}
                            </div>
                            <p className="shrink-0 tabular-nums font-bold text-zinc-900">{money(l.total + freightTotal)}</p>
                          </div>
                          <p className="mt-1 text-xs tabular-nums text-zinc-600">
                            {sqft(l.qty)} · {tons.toFixed(3)} t · {money(l.unitCost)}/ft
                            {freightFt > 0 && <> · frt {money(freightFt)}/ft</>}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
      </div>

      <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
            <tr>
              <th className="px-4 py-3.5">Date</th>
              <th className="px-4 py-3.5">Note</th>
              <th className="px-4 py-3.5">Lines</th>
              <th className="px-4 py-3.5">Qty</th>
              <th className="px-4 py-3.5">Expenses</th>
              <th className="px-4 py-3.5">Total landed</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-600">Loading…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-600">
                  {trips.length === 0 ? "No trips yet" : "No matches"}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((t) => {
                const qy = qtyOf(t);
                const isOpen = expanded === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr className="border-b border-zinc-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-600">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 font-medium text-zinc-800" title={t.note}>
                        {t.note || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                          onClick={() => setExpanded(isOpen ? null : t.id)}
                        >
                          {itemCountOf(t)} items
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${isOpen ? "rotate-180" : ""}`} aria-hidden>
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-zinc-900">{sqft(qy)}</td>
                      <td className="px-4 py-3.5 tabular-nums text-zinc-800">{money(t.expensesTotal)}</td>
                      <td className="px-4 py-3.5 tabular-nums font-bold text-zinc-900">{money(landedOf(t))}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                        <button
                          type="button"
                          className="mr-1 inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50"
                          onClick={() => openEdit(t)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                          Edit costs
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50"
                          onClick={() => onDelete(t)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-zinc-50/80">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white">
                            <table className="w-full text-left text-sm">
                              <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-700">
                                <tr>
                                  <th className="px-3 py-2.5">Marble</th>
                                  <th className="px-3 py-2.5">Qty</th>
                                  <th className="px-3 py-2.5">Tons</th>
                                  <th className="px-3 py-2.5">Price / ft</th>
                                  <th className="px-3 py-2.5">Freight / ft</th>
                                  <th className="px-3 py-2.5">Line + freight</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mergedLinesOf(t).map((l) => {
                                  const tons = lineTons(l.qty, weightOf(l.productId));
                                  const perTonRate = ratePerTon(t.truckFare, t.loadingCost, t.unloadingCost);
                                  const freightTotal = freightShare(perTonRate, tons);
                                  const freightFt = freightPerSqFt(perTonRate, weightOf(l.productId));
                                  const prod = productOf(l.productId);
                                  return (
                                    <tr key={l.productId} className="border-b border-zinc-100 last:border-0">
                                      <td className="px-3 py-2.5">
                                        <p className="font-semibold text-zinc-900">{prod?.name ?? nameOf(l.productId)}</p>
                                        {prod && <p className="font-mono text-sm text-zinc-500">{prod.dimension}</p>}
                                      </td>
                                      <td className="px-3 py-2.5 tabular-nums font-semibold">{sqft(l.qty)}</td>
                                      <td className="px-3 py-2.5 tabular-nums text-zinc-600">{tons.toFixed(3)}</td>
                                      <td className="px-3 py-2.5 tabular-nums">{money(l.unitCost)}</td>
                                      <td className="px-3 py-2.5 tabular-nums text-zinc-600">{money(freightFt)}</td>
                                      <td className="px-3 py-2.5 tabular-nums font-bold">{money(l.total + freightTotal)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-4 sm:px-6">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  {editId ? (
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  ) : (
                    <>
                      <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-4l-3-4h-5v8h2" />
                      <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
                    </>
                  )}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                  {editId ? "Edit trip costs" : "New trip"}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">
                  {editId
                    ? "Update Rs/ton rates — freight/ft recalculates per product weight"
                    : "Pick unattached purchases and set truck / loading / unloading per ton"}
                </p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={close}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                        <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-4l-3-4h-5v8h2" />
                        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
                      </svg>
                      Truck fare / ton
                    </span>
                    <input className="input text-base" type="number" min="0" step="0.01" value={truckFare} onChange={(e) => setTruckFare(e.target.value)} placeholder="0" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                        <path d="M12 5v14" /><path d="M5 12h14" />
                      </svg>
                      Loading / ton
                    </span>
                    <input className="input text-base" type="number" min="0" step="0.01" value={loadingCost} onChange={(e) => setLoadingCost(e.target.value)} placeholder="0" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                        <path d="M12 19V5" /><path d="M5 12h14" />
                      </svg>
                      Unloading / ton
                    </span>
                    <input className="input text-base" type="number" min="0" step="0.01" value={unloadingCost} onChange={(e) => setUnloadingCost(e.target.value)} placeholder="0" />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" /><path d="M14 2v6h6" />
                    </svg>
                    Note
                  </span>
                  <input className="input text-base" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional (supplier, date, vehicle…)" />
                </label>

                {!editId && (
                  <div className="space-y-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                          <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
                        </svg>
                        Purchases
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {selectedPurchases.length} selected
                        {freePurchases.length > 0 && <> · {freePurchases.length - selectedPurchases.length} available</>}
                      </p>
                    </div>

                    {freePurchases.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-4 text-center text-sm text-zinc-600">
                        No unattached purchases — create purchases first, then add them here.
                      </p>
                    ) : (
                      <PurchaseSearchSelect
                        purchases={freePurchases}
                        selectedIds={purchaseIds}
                        products={shop.products}
                        onToggle={(pid) =>
                          setPurchaseIds((prev) =>
                            prev.includes(pid) ? prev.filter((x) => x !== pid) : [pid, ...prev]
                          )
                        }
                        onSetAll={(ids, on) =>
                          setPurchaseIds((prev) =>
                            on ? [...new Set([...ids, ...prev])] : prev.filter((x) => !ids.includes(x))
                          )
                        }
                      />
                    )}

                    {selectedPurchases.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedPurchases.map((p) => {
                          const prod = shop.products.find((x) => x.id === p.productId);
                          const freightFt = freightPerFtSel(p);
                          return (
                            <div key={p.id} className="flex max-w-full items-start gap-2 rounded-lg bg-teal-50 px-2.5 py-2 ring-1 ring-teal-200/80">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-teal-950">
                                  {prod ? productLabel(prod) : "—"}
                                </p>
                                <p className="mt-0.5 text-sm tabular-nums text-teal-800/80">
                                  {sqft(p.qty)} · {money(p.total)}
                                  {freightFt > 0 && <> · frt {money(freightFt)}/ft</>}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="shrink-0 rounded p-0.5 text-teal-700/60 hover:bg-white hover:text-red-600"
                                onClick={() => setPurchaseIds((prev) => prev.filter((x) => x !== p.id))}
                                aria-label="Remove"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {editId && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                    Editing costs updates freight/ft from the Rs/ton rates. To change lines, delete the trip and create a new one.
                  </p>
                )}

                <div className="rounded-xl bg-teal-50/60 px-4 py-3.5 ring-1 ring-teal-200/80">
                  <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-teal-900">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                      <path d="M9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Summary
                  </p>
                  <dl className="space-y-2 text-base">
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-700">Marble cost</dt>
                      <dd className="tabular-nums font-semibold text-zinc-900">{money(marbleTotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-700">Expenses</dt>
                      <dd className="tabular-nums font-semibold text-zinc-900">{money(expensesTotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-700">Trip weight</dt>
                      <dd className="tabular-nums font-semibold text-zinc-900">{totalTons.toFixed(3)} tons</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-teal-200/80 pt-2">
                      <dt className="font-bold text-zinc-900">Total landed</dt>
                      <dd className="tabular-nums text-lg font-bold text-zinc-900">{money(landedTotal)}</dd>
                    </div>
                  </dl>
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">{error}</p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
                <button type="button" onClick={close} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">
                  Cancel
                </button>
                <button type="submit" className="btn text-base" disabled={saving}>
                  {saving ? "Saving…" : editId ? "Save costs" : "Record trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
