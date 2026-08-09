"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import { ProductSearchSelect } from "@/components/ProductSearchSelect";
import {
  allocDisplay,
  allocFromInput,
  defaultAllocations,
  type AllocUnit,
  type SaleAllocation,
  validateAllocations,
} from "@/lib/allocations";
import { money, sqft, qtyLabel, pricePerLabel, unitSuffix } from "@/lib/calc";
import type { Purchase } from "@/lib/types";
import { productLabel } from "@/lib/types";
import { useShop } from "@/lib/store";

type SortKey = "date" | "qty" | "unitCost" | "total";

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  col: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 text-sm font-bold hover:text-zinc-900 ${active ? "text-zinc-900" : "text-zinc-700"}`}
      onClick={onClick}
    >
      {label}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 shrink-0 ${active ? "text-teal-700" : "text-zinc-400"}`} aria-hidden>
        <path d="M8 3.5 4.5 7h7L8 3.5Z" opacity={active && dir === "asc" ? 1 : active ? 0.3 : 0.55} />
        <path d="M8 12.5 11.5 9h-7L8 12.5Z" opacity={active && dir === "desc" ? 1 : active ? 0.3 : 0.55} />
      </svg>
    </button>
  );
}

export default function PurchasesPage() {
  const shop = useShop();
  const { alert, confirm, toast } = useAlert();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [origQty, setOrigQty] = useState(0);
  const [origProductId, setOrigProductId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [description, setDescription] = useState("");
  const [allocations, setAllocations] = useState<SaleAllocation[]>([]);
  const [allocUnit, setAllocUnit] = useState<AllocUnit>("percent");
  const [shareWith, setShareWith] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [fName, setFName] = useState("");
  const [fSize, setFSize] = useState("");
  const [fSource, setFSource] = useState<"all" | "trip" | "standalone">("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const { products, purchases } = shop;
  const rows = useMemo(() => {
    const list = purchases.filter((r) => {
      const prod = products.find((x) => x.id === r.productId);
      if (fName && prod?.name !== fName) return false;
      if (fSize && prod?.dimension !== fSize) return false;
      if (fSource === "trip" && !r.tripId) return false;
      if (fSource === "standalone" && r.tripId) return false;
      if (fFrom && r.date.slice(0, 10) < fFrom) return false;
      if (fTo && r.date.slice(0, 10) > fTo) return false;
      if (fSearch) {
        const hay = `${prod ? productLabel(prod) : ""} ${r.description}`.toLowerCase();
        if (!hay.includes(fSearch.toLowerCase())) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const val = (r: Purchase) =>
        sortKey === "date" ? new Date(r.date).getTime() : r[sortKey];
      const d = Number(val(a)) - Number(val(b));
      return sortDir === "desc" ? -d : d;
    });
  }, [purchases, products, fName, fSize, fSource, fFrom, fTo, fSearch, sortKey, sortDir]);

  if (!shop.ready) return <p className="text-zinc-500">Loading…</p>;

  const reset = () => {
    setEditId(null);
    setOrigQty(0);
    setOrigProductId("");
    setProductId("");
    setQty("");
    setUnitCost("");
    setDescription("");
    setAllocations([]);
    setAllocUnit("percent");
    setShareWith(false);
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

  const openEdit = (r: Purchase) => {
    setEditId(r.id);
    setOrigQty(r.qty);
    setOrigProductId(r.productId);
    setProductId(r.productId);
    setQty(String(r.qty));
    setUnitCost(String(r.unitCost));
    setDescription(r.description || "");
    setError("");
    setOpen(true);
  };

  const syncAllocations = (q: number, productIdHint = productId) => {
    const p = shop.products.find((x) => x.id === productIdHint);
    if (!p) {
      setAllocations([{ partnerId: null, qty: q }]);
      return;
    }
    if (p.shares?.length) {
      setAllocations(defaultAllocations(q, p));
      return;
    }
    setAllocations([
      { partnerId: null, qty: q },
      ...shop.partners.map((partner) => ({ partnerId: partner.id, qty: 0 })),
    ]);
  };

  const onProduct = (id: string) => {
    setProductId(id);
    const p = shop.products.find((x) => x.id === id);
    if (p && !editId) {
      setUnitCost(String(p.costPrice));
      if (shareWith) syncAllocations(Number(qty) || 0, id);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = Number(qty);
    const c = Number(unitCost);
    if (!productId || q <= 0 || c < 0) return;
    if (!editId && shareWith) {
      const err = validateAllocations(q, allocations);
      if (err) {
        setError(err);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await shop.savePurchase({
        id: editId ?? undefined,
        productId,
        qty: q,
        unitCost: c,
        description,
        ...(!editId
          ? {
              allocations: shareWith
                ? allocations
                : [{ partnerId: null, qty: q }],
            }
          : {}),
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (r: Purchase) => {
    if (!(await confirm(`Delete purchase of ${sqft(r.qty, productOf(r.productId)?.unit)}?`))) return;
    try {
      await shop.deletePurchase(r.id);
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const nameOf = (id: string) => {
    const p = shop.products.find((x) => x.id === id);
    return p ? productLabel(p) : "—";
  };

  const activeFilters = [fName, fSize, fSource !== "all", fFrom, fTo, fSearch].filter(Boolean).length;
  const clearFilters = () => {
    setFName("");
    setFSize("");
    setFSource("all");
    setFFrom("");
    setFTo("");
    setFSearch("");
  };
  const productOf = (id: string) => shop.products.find((x) => x.id === id);
  const names = [...new Set(shop.products.map((p) => p.name))].sort();
  const sizes = [...new Set(shop.products.map((p) => p.dimension))].sort();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };
  const sortBtn = (label: string, col: SortKey) => (
    <SortBtn
      label={label}
      col={col}
      active={sortKey === col}
      dir={sortDir}
      onClick={() => toggleSort(col)}
    />
  );

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalSpend = rows.reduce((s, r) => s + r.total, 0);

  const qNum = Number(qty) || 0;
  const costNum = Number(unitCost) || 0;
  const totalCost = qNum * costNum;
  const selected = shop.products.find((p) => p.id === productId);
  const stockBase =
    selected && editId && productId === origProductId
      ? selected.stock - origQty
      : selected?.stock ?? 0;
  const stockAfter = Math.max(0, stockBase + qNum);
  const allocSum = allocations.reduce((s, a) => s + a.qty, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Purchases</h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              {rows.length} of {shop.purchases.length} · {sqft(totalQty)} · {money(totalSpend)}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-40 sm:w-auto"
            disabled={rows.length === 0}
            onClick={async () => {
              const cell = (v: string | number) =>
                String(v ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
              const header = ["Date", "Marble", "Size", "Qty", "Unit cost", "Total", "Description", "Source"];
              const lines = rows.map((r) => {
                const prod = products.find((p) => p.id === r.productId);
                return [
                  r.date.slice(0, 10),
                  prod?.name ?? "",
                  prod?.dimension ?? "",
                  r.qty,
                  r.unitCost,
                  r.total,
                  r.description || "",
                  r.tripId ? "Trip" : "Standalone",
                ]
                  .map(cell)
                  .join("\t");
              });
              await navigator.clipboard.writeText([header.map(cell).join("\t"), ...lines].join("\n"));
              toast(`Copied ${rows.length} purchases`, "success");
            }}
          >
            Copy CSV
          </button>
          <button
            type="button"
            className="btn w-full justify-center text-base sm:w-auto"
            disabled={!shop.products.length}
            onClick={openCreate}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 h-5 w-5" aria-hidden>
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            New purchase
          </button>
        </div>
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
                <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M12 12 4 7" /><path d="m12 12 8-5" /><path d="M12 12v9" />
              </svg>
              Marble
            </span>
            <select className="input text-base" value={fName} onChange={(e) => setFName(e.target.value)}>
              <option value="">All marbles</option>
              {names.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
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
              {sizes.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-4l-3-4h-5v8h2" />
                <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
              Source
            </span>
            <select className="input text-base" value={fSource} onChange={(e) => setFSource(e.target.value as typeof fSource)}>
              <option value="all">All purchases</option>
              <option value="trip">From a trip</option>
              <option value="standalone">Standalone</option>
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
            <input className="input text-base" placeholder="Marble or note…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <span className="shrink-0 text-sm font-semibold text-zinc-600">Sort</span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {([
            ["date", "Date"],
            ["qty", "Qty"],
            ["unitCost", "Price"],
            ["total", "Total"],
          ] as const).map(([key, label]) => {
            const active = sortKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  active ? "bg-teal-700 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-300"
                }`}
              >
                {label}
                {active && <span className="text-xs opacity-90">{sortDir === "desc" ? "↓" : "↑"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
            {shop.purchases.length === 0 ? "No purchases yet" : "No matches"}
          </div>
        )}
        {rows.map((r) => {
          const prod = productOf(r.productId);
          return (
            <article key={r.id} className="min-w-0 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-zinc-900">{prod?.name ?? nameOf(r.productId)}</p>
                  {prod && <p className="font-mono text-sm text-zinc-500">{prod.dimension}</p>}
                  <p className="mt-1 text-sm text-zinc-600">
                    {new Date(r.date).toLocaleDateString()}
                    {r.tripId ? " · Trip" : " · Standalone"}
                  </p>
                </div>
                <p className="shrink-0 text-right text-lg tabular-nums font-bold text-zinc-900">{money(r.total)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">Qty</p>
                  <p className="font-semibold tabular-nums text-zinc-900">{sqft(r.qty, prod?.unit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-zinc-500">{pricePerLabel(prod?.unit)}</p>
                  <p className="font-semibold tabular-nums text-zinc-800">{money(r.unitCost)}</p>
                </div>
              </div>
              {r.description && (
                <p className="mt-2 truncate text-sm text-zinc-500" title={r.description}>{r.description}</p>
              )}
              <div className="mt-3 flex gap-1.5 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                  onClick={() => openEdit(r)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                  onClick={() => onDelete(r)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
            <tr>
              <th className="px-4 py-3.5">{sortBtn("Date", "date")}</th>
              <th className="px-4 py-3.5">Marble</th>
              <th className="px-4 py-3.5">Source</th>
              <th className="px-4 py-3.5">{sortBtn("Qty", "qty")}</th>
              <th className="px-4 py-3.5">{sortBtn("Price / unit", "unitCost")}</th>
              <th className="px-4 py-3.5">{sortBtn("Total", "total")}</th>
              <th className="px-4 py-3.5">Note</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-600">
                  {shop.purchases.length === 0 ? "No purchases yet" : "No matches"}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const prod = productOf(r.productId);
              return (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm text-zinc-600">
                    {new Date(r.date).toLocaleDateString()}
                    <span className="block text-xs text-zinc-500">
                      {new Date(r.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-zinc-900">{prod?.name ?? nameOf(r.productId)}</p>
                    {prod && <p className="mt-0.5 font-mono text-sm text-zinc-500">{prod.dimension}</p>}
                  </td>
                  <td className="px-4 py-3.5">
                    {r.tripId ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-sm font-semibold text-sky-900 ring-1 ring-sky-200">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                          <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-4l-3-4h-5v8h2" />
                          <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
                        </svg>
                        Trip
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-500">Standalone</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums font-semibold text-zinc-900">{sqft(r.qty, prod?.unit)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-zinc-800">{money(r.unitCost)}</td>
                  <td className="px-4 py-3.5 tabular-nums font-bold text-zinc-900">{money(r.total)}</td>
                  <td className="max-w-[160px] truncate px-4 py-3.5 text-sm text-zinc-600" title={r.description}>
                    {r.description || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
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

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  {editId ? (
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  ) : (
                    <>
                      <circle cx="8" cy="21" r="1" />
                      <circle cx="19" cy="21" r="1" />
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
                    </>
                  )}
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                  {editId ? "Edit purchase" : "New purchase"}
                </h2>
                <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">
                  {editId ? "Update this purchase and recalculate stock" : "Add received stock to inventory"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close"
                onClick={close}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M12 12 4 7" /><path d="m12 12 8-5" /><path d="M12 12v9" />
                  </svg>
                  Marble · size
                </span>
                <ProductSearchSelect products={shop.products} value={productId} onChange={onProduct} placeholder="Select marble · size…" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    </svg>
                    {qtyLabel(selected?.unit)}
                  </span>
                  <input
                    className="input text-base"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={selected?.unit === "piece" ? "e.g. 100" : "e.g. 500"}
                    value={qty}
                    onChange={(e) => {
                      setQty(e.target.value);
                      if (!editId && shareWith) syncAllocations(Number(e.target.value) || 0);
                    }}
                    required
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                      <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    {pricePerLabel(selected?.unit)}
                  </span>
                  <input
                    className="input text-base"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 85"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
                    <path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                  </svg>
                  Description
                </span>
                <textarea
                  className="input min-h-[80px] resize-y text-base"
                  placeholder="Optional notes (supplier, batch, etc.)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              {!editId && shop.partners.length > 0 && productId && (
                <fieldset className="space-y-3 rounded-xl border border-zinc-300 bg-zinc-50/80 p-4">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-zinc-300 text-teal-700"
                      checked={shareWith}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setShareWith(on);
                        if (on) syncAllocations(Number(qty) || 0);
                        else setAllocations([]);
                      }}
                    />
                    <span className="text-sm font-bold text-zinc-800">Purchase shares</span>
                    <span className="text-sm text-zinc-500">— split with partners</span>
                  </label>
                  {shareWith && (
                    <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-600">Who owns this purchase? Sum must match qty.</p>
                    <div className="flex gap-1.5">
                      {([["percent", "%"], ["sqft", unitSuffix(selected?.unit)], ["amount", "Rs"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setAllocUnit(key)}
                          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                            allocUnit === key
                              ? "bg-teal-700 text-white"
                              : "bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {allocations.map((a, i) => {
                    const label = a.partnerId
                      ? shop.partners.find((p) => p.id === a.partnerId)?.name || "Partner"
                      : "You";
                    const display = allocDisplay(a.qty, allocUnit, qNum, costNum);
                    return (
                      <label key={`${a.partnerId ?? "me"}-${i}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
                        <span className="shrink-0 text-base font-semibold text-zinc-800 sm:w-28">{label}</span>
                        <input
                          className="input min-w-0 flex-1 text-base"
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number(display.toFixed(2))}
                          onChange={(e) => {
                            const next = [...allocations];
                            next[i] = {
                              ...next[i],
                              qty: allocFromInput(Number(e.target.value) || 0, allocUnit, qNum, costNum),
                            };
                            setAllocations(next);
                          }}
                        />
                        <span className="shrink-0 tabular-nums text-sm font-medium text-zinc-600">
                          {allocUnit !== "sqft" && `${sqft(a.qty, selected?.unit)} · `}
                          {money(a.qty * costNum)}
                        </span>
                      </label>
                    );
                  })}
                  <p className={`text-sm font-semibold ${Math.abs(allocSum - qNum) > 0.02 ? "text-red-700" : "text-zinc-600"}`}>
                    Allocated {sqft(allocSum, selected?.unit)} / {sqft(qNum, selected?.unit)}
                  </p>
                    </>
                  )}
                </fieldset>
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
                    <dt className="text-zinc-700">Quantity</dt>
                    <dd className="tabular-nums font-semibold text-zinc-900">{qNum ? sqft(qNum, selected?.unit) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-700">{pricePerLabel(selected?.unit)}</dt>
                    <dd className="tabular-nums font-semibold text-zinc-900">{money(costNum)}</dd>
                  </div>
                  {selected && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-700">Stock after</dt>
                      <dd className="tabular-nums font-semibold text-zinc-900">{sqft(Math.max(0, stockAfter), selected?.unit)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-teal-200/80 pt-2">
                    <dt className="font-bold text-zinc-900">Total</dt>
                    <dd className="tabular-nums text-lg font-bold text-zinc-900">{money(totalCost)}</dd>
                  </div>
                </dl>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button type="submit" className="btn text-base" disabled={saving || !productId}>
                  {saving ? "Saving…" : editId ? "Save changes" : "Record purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
