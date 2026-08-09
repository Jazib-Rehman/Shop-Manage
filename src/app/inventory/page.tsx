"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toPng } from "html-to-image";
import { money, qtyLabel, sqft, unitShort, unitSuffix } from "@/lib/calc";
import type { Product, ProductShare } from "@/lib/types";
import { mySharePercent, productLabel } from "@/lib/types";
import { useAlert } from "@/components/Alert";
import { useShop } from "@/lib/store";

type ShareUnit = "percent" | "sqft" | "amount";
type HistEntry = {
  id: string;
  kind: "purchase" | "loss" | "surplus";
  qty: number;
  unitCost?: number;
  tripId?: string | null;
  note: string;
  date: string;
};
type AdjMap = Record<string, { loss: number; surplus: number }>;

function toPercent(value: number, unit: ShareUnit, p: Product) {
  if (unit === "percent") return value;
  if (unit === "sqft") return p.stock > 0 ? (value / p.stock) * 100 : 0;
  const stockValue = p.stock * p.costPrice;
  return stockValue > 0 ? (value / stockValue) * 100 : 0;
}

function fromPercent(percent: number, unit: ShareUnit, p: Product) {
  if (unit === "percent") return percent;
  if (unit === "sqft") return (percent / 100) * p.stock;
  return (percent / 100) * p.stock * p.costPrice;
}

export default function InventoryPage() {
  const shop = useShop();
  const { alert, confirm, toast } = useAlert();
  const [edit, setEdit] = useState<Product | null>(null);
  const [shares, setShares] = useState<ProductShare[]>([]);
  const [unit, setUnit] = useState<ShareUnit>("percent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [hist, setHist] = useState<Product | null>(null);
  const [entries, setEntries] = useState<HistEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjFor, setAdjFor] = useState<Product | null>(null);
  const [adjEditId, setAdjEditId] = useState<string | null>(null);
  const [adjType, setAdjType] = useState<"loss" | "surplus">("loss");
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjError, setAdjError] = useState("");
  const [q, setQ] = useState("");
  const [size, setSize] = useState("");
  const [own, setOwn] = useState<"all" | "yours" | "shared">("all");
  const [stock, setStock] = useState<"all" | "in" | "low" | "out">("all");
  const [partnerId, setPartnerId] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"stock" | "cost" | "value">("stock");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [adjMap, setAdjMap] = useState<AdjMap>({});
  const [snapping, setSnapping] = useState(false);
  const [costFor, setCostFor] = useState<Product | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (productId: string) => {
    setHistLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEntries(data.entries || []);
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hist) return;
    loadHistory(hist.id).catch(console.error);
  }, [hist, loadHistory]);

  if (!shop.ready) return <p className="text-base text-zinc-600">Loading…</p>;

  const openShares = (p: Product) => {
    setEdit(p);
    setShares(p.shares?.length ? [...p.shares] : []);
    setUnit("percent");
    setError("");
  };

  const openHistory = (p: Product) => {
    setHist(p);
    setEntries([]);
    setAdjError("");
    setAdjOpen(false);
    setAdjEditId(null);
  };

  const openAdjCreate = (p: Product) => {
    setAdjFor(p);
    setAdjEditId(null);
    setAdjType("loss");
    setAdjQty("");
    setAdjNote("");
    setAdjError("");
    setAdjOpen(true);
  };

  const openAdjEdit = (e: HistEntry) => {
    if (!hist || (e.kind !== "loss" && e.kind !== "surplus")) return;
    setAdjFor(hist);
    setAdjEditId(e.id);
    setAdjType(e.kind);
    setAdjQty(String(e.qty));
    setAdjNote(e.note || "");
    setAdjError("");
    setAdjOpen(true);
  };

  const syncProduct = (updated: Product) => {
    if (hist?.id === updated.id) setHist({ ...hist, stock: updated.stock, costPrice: updated.costPrice });
    if (adjFor?.id === updated.id) setAdjFor({ ...adjFor, stock: updated.stock, costPrice: updated.costPrice });
  };

  const onAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjFor) return;
    setAdjSaving(true);
    setAdjError("");
    try {
      const url = adjEditId
        ? `/api/products/${adjFor.id}/adjustments/${adjEditId}`
        : `/api/products/${adjFor.id}/adjustments`;
      const res = await fetch(url, {
        method: adjEditId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: adjType, qty: Number(adjQty), note: adjNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAdjOpen(false);
      await shop.refresh();
      syncProduct(data.product as Product);
      if (hist?.id === adjFor.id) await loadHistory(adjFor.id);
      toast(adjEditId ? "Adjustment updated" : "Adjustment recorded", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setAdjError(msg);
      toast(msg, "error");
    } finally {
      setAdjSaving(false);
    }
  };

  const onDeleteAdj = async (e: HistEntry) => {
    if (!hist || (e.kind !== "loss" && e.kind !== "surplus")) return;
    if (!(await confirm(`Delete this ${e.kind}?`))) return;
    try {
      const res = await fetch(`/api/products/${hist.id}/adjustments/${e.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await shop.refresh();
      syncProduct(data.product as Product);
      await loadHistory(hist.id);
      toast("Adjustment deleted", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast(msg, "error");
      await alert(msg);
    }
  };

  const partnerName = (id: string) =>
    shop.partners.find((x) => x.id === id)?.name ?? "Partner";

  const partnerSum = shares.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const myPct = Math.max(0, 100 - partnerSum);

  const onSaveShares = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    if (partnerSum > 100) {
      setError("Partner shares cannot exceed 100%");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await shop.saveProductShares(
        edit.id,
        shares.filter((s) => s.partnerId && s.percent > 0)
      );
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addShareRow = () => {
    const next = shop.partners.find((p) => !shares.some((s) => s.partnerId === p.id));
    if (!next) return;
    setShares([...shares, { partnerId: next.id, percent: 0 }]);
  };

  const kindLabel = { purchase: "Purchase", loss: "Loss", surplus: "Surplus" } as const;

  const sizes = [...new Set(shop.products.map((p) => p.dimension))].sort();
  const names = [...new Set(shop.products.map((p) => p.name))].sort();
  const activeFilters = [q, size, own !== "all", partnerId, stock !== "all"].filter(Boolean).length;

  const toggleSort = (key: "stock" | "cost" | "value") => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortBtn = (label: string, col: "stock" | "cost" | "value") => {
    const active = sortKey === col;
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1 text-sm font-bold hover:text-zinc-900 ${active ? "text-zinc-900" : "text-zinc-700"}`}
        onClick={() => toggleSort(col)}
      >
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-teal-700" : "text-zinc-500"}`}
          aria-hidden
        >
          <path d={`M8 3.5 4.5 7h7L8 3.5Z`} opacity={active && sortDir === "asc" ? 1 : active ? 0.3 : 0.55} />
          <path d={`M8 12.5 11.5 9h-7L8 12.5Z`} opacity={active && sortDir === "desc" ? 1 : active ? 0.3 : 0.55} />
        </svg>
      </button>
    );
  };

  const rows = shop.products
    .filter((p) => {
      if (q && p.name !== q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (size && p.dimension !== size) return false;
      if (own === "yours" && p.shares?.length) return false;
      if (own === "shared" && !p.shares?.length) return false;
      if (partnerId && !p.shares?.some((s) => s.partnerId === partnerId)) return false;
      if (stock === "in" && !(p.stock > 0)) return false;
      if (stock === "out" && p.stock > 0) return false;
      if (stock === "low" && !(p.stock > 0 && p.stock <= p.lowStockAt)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = sortKey === "stock" ? a.stock : sortKey === "cost" ? a.costPrice : a.stock * a.costPrice;
      const bv = sortKey === "stock" ? b.stock : sortKey === "cost" ? b.costPrice : b.stock * b.costPrice;
      return sortDir === "desc" ? bv - av : av - bv;
    });

  const clearFilters = () => {
    setQ("");
    setSize("");
    setOwn("all");
    setPartnerId("");
    setStock("all");
  };

  const openSummary = async () => {
    setSummaryOpen(true);
    try {
      const res = await fetch("/api/adjustments/summary");
      if (res.ok) setAdjMap(await res.json());
    } catch {
      setAdjMap({});
    }
  };

  const downloadSummary = async () => {
    if (!summaryRef.current) return;
    setSnapping(true);
    try {
      const dataUrl = await toPng(summaryRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        filter: (node) =>
          !(node instanceof Element && node.closest("[data-shot-ignore]")),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `inventory-summary-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally {
      setSnapping(false);
    }
  };

  const inStock = shop.products.filter((p) => p.stock > 0).sort((a, b) => b.stock - a.stock);

  const ownershipLines = (p: Product) => {
    const lines: string[] = [];
    const mine = mySharePercent(p);
    if (mine > 0) lines.push(`You · ${sqft((mine / 100) * p.stock, p.unit)}`);
    for (const s of p.shares || []) {
      if (!(s.percent > 0)) continue;
      lines.push(`${partnerName(s.partnerId)} · ${sqft((s.percent / 100) * p.stock, p.unit)}`);
    }
    if (!lines.length) lines.push(`You · ${sqft(p.stock, p.unit)}`);
    return lines;
  };

  const actionBtns = (p: Product, compact = false) => (
    <div className={`flex ${compact ? "flex-wrap gap-1.5" : "justify-end gap-1"}`}>
      <button
        type="button"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-teal-800 sm:flex-none sm:ring-0 sm:hover:bg-zinc-100"
        title="History"
        aria-label="History"
        onClick={() => openHistory(p)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <path d="M12 8v4l2.5 1.5M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        History
      </button>
      <button
        type="button"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-50 sm:flex-none sm:ring-0"
        onClick={() => openAdjCreate(p)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" /><path d="M12 17h.01" />
        </svg>
        {compact ? "Adjust" : "Loss / surplus"}
      </button>
      <button
        type="button"
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50 sm:flex-none sm:ring-0"
        onClick={() => openShares(p)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Owners
      </button>
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Inventory</h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              {rows.length} of {shop.products.length} SKUs · sorted by{" "}
              {sortKey === "stock" ? "stock" : sortKey === "cost" ? "avg cost" : "value"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50"
            onClick={openSummary}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
              <path d="M3 3v18h18" /><path d="M7 16V9" /><path d="M12 16v-5" /><path d="M17 16V6" />
            </svg>
            Summary
          </button>
          <Link href="/partners" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100 sm:ring-0">
            Partners
          </Link>
          <Link href="/catalog" className="btn col-span-2 justify-center sm:col-span-1">
            Manage marbles
          </Link>
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
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 bg-zinc-50/80 p-3 sm:grid sm:grid-cols-2 sm:p-4 lg:grid-cols-5`}>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M12 12 4 7" /><path d="m12 12 8-5" /><path d="M12 12v9" />
              </svg>
              Marble
            </span>
            <select className="input text-base" value={names.includes(q) ? q : ""} onChange={(e) => setQ(e.target.value)}>
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
            <select className="input text-base" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">All sizes</option>
              {sizes.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Ownership
            </span>
            <select className="input text-base" value={own} onChange={(e) => setOwn(e.target.value as typeof own)}>
              <option value="all">All</option>
              <option value="yours">Yours only</option>
              <option value="shared">Shared</option>
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Partner
            </span>
            <select className="input text-base" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">Any</option>
              {shop.partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              </svg>
              Stock status
            </span>
            <select className="input text-base" value={stock} onChange={(e) => setStock(e.target.value as typeof stock)}>
              <option value="all">All</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
        </div>
        <div className={`${filtersOpen ? "block" : "hidden"} border-t border-zinc-200 bg-white px-3 py-3 sm:block sm:px-4 sm:py-3.5`}>
          <label className="block space-y-1.5 text-sm sm:max-w-md">
            <span className="flex items-center gap-1.5 font-semibold text-zinc-800">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              Search
            </span>
            <input className="input text-base" placeholder="Type marble name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Mobile sort */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="shrink-0 text-sm font-semibold text-zinc-600">Sort</span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {([
            ["stock", "Stock"],
            ["cost", "Cost"],
            ["value", "Value"],
          ] as const).map(([key, label]) => {
            const active = sortKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  active
                    ? "bg-teal-700 text-white"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-300"
                }`}
              >
                {label}
                {active && (
                  <span className="text-xs opacity-90">{sortDir === "desc" ? "↓" : "↑"}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {shop.products.length === 0 && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
            No SKUs — <Link href="/catalog" className="font-semibold text-teal-800 underline">add marbles & sizes</Link>
          </div>
        )}
        {shop.products.length > 0 && rows.length === 0 && (
          <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
            No matches
          </div>
        )}
        {rows.map((p) => (
          <article
            key={p.id}
            className="min-w-0 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-zinc-900">{p.name}</h3>
                <p className="mt-0.5 font-mono text-sm text-zinc-600">{p.dimension}</p>
              </div>
              <p
                className={`shrink-0 text-right text-lg tabular-nums font-bold ${
                  p.stock <= p.lowStockAt ? "text-amber-800" : "text-zinc-900"
                }`}
              >
                {sqft(p.stock, p.unit)}
              </p>
            </div>

            <div className="mt-3 space-y-0.5 text-sm text-zinc-600">
              {ownershipLines(p).map((line) => (
                <p key={line} className="truncate">{line}</p>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
              <button
                type="button"
                className="rounded-lg bg-zinc-50 px-3 py-2 text-left ring-1 ring-zinc-200"
                onClick={() => setCostFor(p)}
              >
                <p className="text-xs font-semibold text-zinc-500">Landed</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">{money(p.costPrice)}</p>
              </button>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
                <p className="text-xs font-semibold text-zinc-500">Value</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">{money(p.stock * p.costPrice)}</p>
              </div>
            </div>

            <div className="mt-3 border-t border-zinc-100 pt-3">
              {actionBtns(p, true)}
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
        <table className="w-full text-left text-base">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
            <tr>
              <th className="px-4 py-3.5">Marble</th>
              <th className="px-4 py-3.5">
                {sortBtn("Stock", "stock")}
              </th>
              <th className="px-4 py-3.5">Ownership</th>
              <th className="px-4 py-3.5">
                {sortBtn("Landed Price", "cost")}
              </th>
              <th className="px-4 py-3.5">
                {sortBtn("Value", "value")}
              </th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shop.products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                  No SKUs — <Link href="/catalog" className="font-semibold text-teal-800 underline">add marbles & sizes</Link>
                </td>
              </tr>
            )}
            {shop.products.length > 0 && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No matches</td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3.5">
                  <p className="font-semibold text-zinc-900">{p.name}</p>
                  <p className="mt-0.5 font-mono text-sm text-zinc-600">{p.dimension}</p>
                </td>
                <td className={`px-4 py-3.5 tabular-nums font-semibold ${p.stock <= p.lowStockAt ? "text-amber-800" : "text-zinc-900"}`}>
                  {sqft(p.stock, p.unit)}
                </td>
                <td className="max-w-[220px] px-4 py-3.5 text-sm text-zinc-700">
                  <div className="space-y-0.5">
                    {ownershipLines(p).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3.5 tabular-nums">
                  <button
                    type="button"
                    className="text-left text-base font-bold text-teal-800 hover:underline"
                    onClick={() => setCostFor(p)}
                  >
                    {money(p.costPrice)}
                  </button>
                </td>
                <td className="px-4 py-3.5 tabular-nums font-semibold text-zinc-900">{money(p.stock * p.costPrice)}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                  {actionBtns(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {costFor && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setCostFor(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-sm rounded-t-2xl border border-zinc-200/80 bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Cost breakdown</h2>
              <p className="mt-0.5 truncate text-sm text-zinc-500">{productLabel(costFor)}</p>
            </div>
            <dl className="space-y-2.5 px-5 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Actual</dt>
                <dd className="tabular-nums font-medium">{money(costFor.costActual || 0)} / {unitShort(costFor.unit)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Freight</dt>
                <dd className="tabular-nums font-medium">{money(costFor.costFreight || 0)} / {unitShort(costFor.unit)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Loss</dt>
                <dd className="tabular-nums font-medium">{money(costFor.costLoss || 0)} / {unitShort(costFor.unit)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-zinc-100 pt-2.5">
                <dt className="font-medium text-zinc-800">Final avg</dt>
                <dd className="tabular-nums text-base font-semibold">{money(costFor.costPrice)} / {unitShort(costFor.unit)}</dd>
              </div>
            </dl>
            <div className="flex justify-end border-t border-zinc-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setCostFor(null)}
                className="rounded-lg px-3.5 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={() => setEdit(null)} />
          <div role="dialog" aria-modal="true" className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">Ownership</h2>
                <p className="mt-0.5 truncate text-sm text-zinc-600 sm:text-base">{productLabel(edit)}</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={() => setEdit(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 sm:grid-cols-4">
              {[
                ["Stock", sqft(edit.stock, edit.unit)],
                ["Avg cost", `${money(edit.costPrice)}/${unitShort(edit.unit)}`],
                ["Cost value", money(edit.stock * edit.costPrice)],
                ["Retail value", money(edit.stock * edit.sellPrice)],
              ].map(([label, value]) => (
                <div key={label as string} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm sm:p-3">
                  <p className="text-xs font-semibold text-zinc-600 sm:text-sm">{label}</p>
                  <p className="mt-1 break-words text-sm font-bold tabular-nums text-zinc-900 sm:text-base">{value}</p>
                </div>
              ))}
            </div>
            <form onSubmit={onSaveShares} className="space-y-5 px-4 py-5 sm:px-6">
              {/* Mobile ownership cards */}
              <div className="space-y-2 sm:hidden">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-900">You</p>
                    <p className="tabular-nums font-bold text-zinc-900">{myPct.toFixed(1)}%</p>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {sqft((myPct / 100) * edit.stock, edit.unit)} · {money((myPct / 100) * edit.stock * edit.costPrice)}
                  </p>
                </div>
                {shares.map((s) => (
                  <div key={s.partnerId} className="rounded-xl border border-zinc-200 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-zinc-800">{partnerName(s.partnerId)}</p>
                      <p className="shrink-0 tabular-nums font-bold">{s.percent.toFixed(1)}%</p>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {sqft((s.percent / 100) * edit.stock, edit.unit)} · {money((s.percent / 100) * edit.stock * edit.costPrice)}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl border-2 border-zinc-300 bg-zinc-50 px-3 py-3 font-bold">
                  <div className="flex justify-between gap-2">
                    <span>Total</span>
                    <span className="tabular-nums">{(myPct + partnerSum).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-zinc-700">
                    {sqft(edit.stock, edit.unit)} · {money(edit.stock * edit.costPrice)}
                  </p>
                </div>
              </div>

              {/* Desktop ownership table */}
              <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-300 sm:block">
                <table className="w-full min-w-[28rem] text-left text-base">
                  <thead className="bg-zinc-50 text-sm font-semibold text-zinc-700">
                    <tr>
                      <th className="px-3 py-2.5">Owner</th>
                      <th className="px-3 py-2.5">%</th>
                      <th className="px-3 py-2.5">Sq ft</th>
                      <th className="px-3 py-2.5">Cost value</th>
                      <th className="px-3 py-2.5">Retail</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-zinc-100">
                      <td className="px-3 py-2.5 font-semibold text-zinc-900">You</td>
                      <td className="px-3 py-2.5 tabular-nums font-medium">{myPct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 tabular-nums">{sqft((myPct / 100) * edit.stock, edit.unit)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money((myPct / 100) * edit.stock * edit.costPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money((myPct / 100) * edit.stock * edit.sellPrice)}</td>
                    </tr>
                    {shares.map((s) => (
                      <tr key={s.partnerId} className="border-t border-zinc-100">
                        <td className="px-3 py-2.5 font-medium text-zinc-800">{partnerName(s.partnerId)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-medium">{s.percent.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 tabular-nums">{sqft((s.percent / 100) * edit.stock, edit.unit)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{money((s.percent / 100) * edit.stock * edit.costPrice)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{money((s.percent / 100) * edit.stock * edit.sellPrice)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-bold">
                      <td className="px-3 py-2.5">Total</td>
                      <td className="px-3 py-2.5 tabular-nums">{(myPct + partnerSum).toFixed(1)}%</td>
                      <td className="px-3 py-2.5 tabular-nums">{sqft(edit.stock, edit.unit)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money(edit.stock * edit.costPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{money(edit.stock * edit.sellPrice)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 px-3 py-3 ring-1 ring-zinc-200 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
                <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  Edit shares
                </span>
                <div className="flex gap-1.5">
                  {([["percent", "%"], ["sqft", unitSuffix(edit?.unit)], ["amount", "Rs"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUnit(key)}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                        unit === key ? "bg-teal-700 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {unit !== "percent" && (
                <p className="text-sm text-zinc-600">
                  Enter in {unit === "sqft" ? unitSuffix(edit?.unit) : "Rs"}; converted to % for saving.
                </p>
              )}

              {shop.partners.length === 0 ? (
                <p className="text-base text-zinc-600">
                  No partners yet — <Link href="/partners" className="font-semibold text-teal-800 underline">add one</Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {shares.map((s, i) => {
                    const display = edit ? fromPercent(s.percent, unit, edit) : 0;
                    return (
                      <div key={`${s.partnerId}-${i}`} className="space-y-1">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            className="input min-w-0 flex-1 text-base"
                            value={s.partnerId}
                            onChange={(e) => {
                              const next = [...shares];
                              next[i] = { ...next[i], partnerId: e.target.value };
                              setShares(next);
                            }}
                          >
                            {shop.partners.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              className="input min-w-0 flex-1 text-base sm:w-28 sm:flex-none"
                              type="number"
                              min="0"
                              step="0.01"
                              value={Number(display.toFixed(2))}
                              onChange={(e) => {
                                if (!edit) return;
                                const next = [...shares];
                                next[i] = {
                                  ...next[i],
                                  percent: toPercent(Number(e.target.value) || 0, unit, edit),
                                };
                                setShares(next);
                              }}
                            />
                            <button
                              type="button"
                              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                              onClick={() => setShares(shares.filter((_, j) => j !== i))}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        {unit !== "percent" && (
                          <p className="pl-1 text-sm text-zinc-500">= {s.percent.toFixed(1)}%</p>
                        )}
                      </div>
                    );
                  })}
                  {shares.length < shop.partners.length && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-base font-semibold text-teal-800 hover:underline"
                      onClick={addShareRow}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                        <path d="M12 5v14" /><path d="M5 12h14" />
                      </svg>
                      Add partner share
                    </button>
                  )}
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">{error}</p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEdit(null)} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">
                  Cancel
                </button>
                <button type="submit" className="btn text-base" disabled={saving}>
                  {saving ? "Saving…" : "Save ownership"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {hist && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={() => setHist(null)} />
          <div role="dialog" aria-modal="true" className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                    <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" />
                    <path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">Stock history</h2>
                  <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">
                    <span className="font-medium text-zinc-800">{productLabel(hist)}</span>
                    <span className="block sm:inline"> · {sqft(hist.stock, hist.unit)} · final {money(hist.costPrice)}</span>
                  </p>
                  {(hist.costFreight > 0 || hist.costLoss > 0) && (
                    <p className="mt-1 text-sm text-zinc-500">
                      Actual {money(hist.costActual || 0)}
                      {hist.costFreight > 0 && <> · frt {money(hist.costFreight)}</>}
                      {hist.costLoss > 0 && <> · loss {money(hist.costLoss)}</>}
                    </p>
                  )}
                </div>
                <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={() => setHist(null)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                className="btn mt-3 w-full justify-center text-base sm:mt-3 sm:w-auto"
                onClick={() => openAdjCreate(hist)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 h-4 w-4" aria-hidden>
                  <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
                Loss / surplus
              </button>
            </div>

            <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {histLoading ? (
                <p className="text-base text-zinc-600">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="py-8 text-center text-base text-zinc-600">No purchases or adjustments yet</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {entries.map((e) => (
                    <li key={`${e.kind}-${e.id}`} className="flex items-start justify-between gap-3 py-3.5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            e.kind === "loss"
                              ? "bg-red-50 text-red-700"
                              : e.kind === "surplus"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-teal-50 text-teal-800"
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                            {e.kind === "loss" ? (
                              <path d="M5 12h14" />
                            ) : e.kind === "surplus" ? (
                              <><path d="M12 5v14" /><path d="M5 12h14" /></>
                            ) : (
                              <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" /></>
                            )}
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-zinc-900">{kindLabel[e.kind]}</p>
                          <p className="text-sm text-zinc-500">{new Date(e.date).toLocaleString()}</p>
                          {e.kind === "purchase" && e.unitCost != null && (
                            <p className="mt-0.5 text-sm tabular-nums text-zinc-600">
                              {money(e.unitCost)} / {unitShort(hist.unit)}
                              {e.tripId ? " · via trip" : ""}
                            </p>
                          )}
                          {e.note && <p className="mt-0.5 truncate text-sm text-zinc-500" title={e.note}>{e.note}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`text-base tabular-nums font-bold ${
                            e.kind === "loss" ? "text-red-700" : "text-emerald-700"
                          }`}
                        >
                          {e.kind === "loss" ? "−" : "+"}
                          {sqft(e.qty, hist.unit)}
                        </span>
                        {(e.kind === "loss" || e.kind === "surplus") && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                              onClick={() => openAdjEdit(e)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                              onClick={() => onDeleteAdj(e)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {adjOpen && adjFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={() => setAdjOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                  {adjEditId ? "Edit adjustment" : "Loss / surplus"}
                </h2>
                <p className="mt-0.5 truncate text-sm text-zinc-600 sm:text-base">{productLabel(adjFor)}</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close" onClick={() => setAdjOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={onAdjust} className="space-y-5 px-4 py-5 sm:px-5">
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  Type
                </span>
                <select className="input text-base" value={adjType} onChange={(e) => setAdjType(e.target.value as "loss" | "surplus")}>
                  <option value="loss">Loss (− avg cost ↑)</option>
                  <option value="surplus">Surplus (+ avg cost ↓)</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                  </svg>
                  {qtyLabel(adjFor?.unit)}
                </span>
                <input className="input text-base" type="number" min="0.01" step="0.01" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} required />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" /><path d="M14 2v6h6" />
                  </svg>
                  Note
                </span>
                <input className="input text-base" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Broken, short, etc." />
              </label>
              {adjError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">{adjError}</p>
              )}
              <div className="flex flex-col-reverse gap-2 border-t border-zinc-200 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setAdjOpen(false)} className="rounded-lg px-4 py-2.5 text-base font-semibold text-zinc-700 hover:bg-zinc-100">
                  Cancel
                </button>
                <button type="submit" className="btn text-base" disabled={adjSaving}>
                  {adjSaving ? "Saving…" : adjEditId ? "Save" : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {summaryOpen && (() => {
        const totalStock = inStock.reduce((s, p) => s + p.stock, 0);
        const totalValue = inStock.reduce((s, p) => s + p.stock * p.costPrice, 0);
        const totalLoss = inStock.reduce((s, p) => s + (adjMap[p.id]?.loss || 0), 0);
        const totalSurplus = inStock.reduce((s, p) => s + (adjMap[p.id]?.surplus || 0), 0);
        return (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[2px]" aria-label="Close" onClick={() => setSummaryOpen(false)} />
          <div
            ref={summaryRef}
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-300 bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                    <path d="M3 3v18h18" /><path d="M7 16v-5" /><path d="M12 16V8" /><path d="M17 16v-9" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">Inventory summary</h2>
                  <p className="mt-0.5 text-sm text-zinc-600 sm:text-base">
                    {inStock.length} SKUs · {sqft(totalStock)} · {money(totalValue)}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 sm:hidden"
                  aria-label="Close"
                  data-shot-ignore
                  onClick={() => setSummaryOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2" data-shot-ignore>
                <button
                  type="button"
                  onClick={downloadSummary}
                  disabled={snapping}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-50 sm:flex-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  {snapping ? "Saving…" : "Snapshot"}
                </button>
                <button
                  type="button"
                  className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 sm:inline-flex"
                  aria-label="Close"
                  onClick={() => setSummaryOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
              {/* Mobile summary cards */}
              <div className="space-y-3 sm:hidden">
                {inStock.length === 0 && (
                  <p className="py-10 text-center text-zinc-600">No stock on hand</p>
                )}
                {inStock.map((p) => {
                  const adj = adjMap[p.id] || { loss: 0, surplus: 0 };
                  return (
                    <article key={p.id} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-zinc-900">{p.name}</p>
                          <p className="font-mono text-sm text-zinc-500">{p.dimension}</p>
                        </div>
                        <p className="shrink-0 tabular-nums font-bold text-zinc-900">{sqft(p.stock, p.unit)}</p>
                      </div>
                      <div className="mt-2 space-y-0.5 text-sm text-zinc-600">
                        {ownershipLines(p).map((line) => (
                          <p key={line} className="truncate">{line}</p>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-zinc-500">Landed</p>
                          <p className="font-medium tabular-nums text-zinc-800">{money(p.costPrice)}</p>
                          {(p.costFreight > 0 || p.costLoss > 0) && (
                            <p className="mt-0.5 text-xs leading-tight text-zinc-500">
                              {money(p.costActual || 0)}
                              {p.costFreight > 0 && <> · frt {money(p.costFreight)}</>}
                              {p.costLoss > 0 && <> · loss {money(p.costLoss)}</>}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-zinc-500">Value</p>
                          <p className="font-bold tabular-nums text-zinc-900">{money(p.stock * p.costPrice)}</p>
                          {(adj.loss > 0 || adj.surplus > 0) && (
                            <div className="mt-0.5 space-y-0.5 text-xs">
                              {adj.loss > 0 && <p className="font-semibold text-red-700">−{sqft(adj.loss, p.unit)}</p>}
                              {adj.surplus > 0 && <p className="font-semibold text-emerald-700">+{sqft(adj.surplus, p.unit)}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {inStock.length > 0 && (
                  <div className="rounded-xl border-2 border-zinc-300 bg-zinc-50 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-700">Total · {inStock.length} SKUs</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="text-lg tabular-nums font-bold text-zinc-900">{sqft(totalStock)}</p>
                      <p className="text-lg tabular-nums font-bold text-zinc-900">{money(totalValue)}</p>
                    </div>
                    {(totalLoss > 0 || totalSurplus > 0) && (
                      <div className="mt-1 flex gap-3 text-sm">
                        {totalLoss > 0 && <p className="font-bold text-red-700">−{sqft(totalLoss)}</p>}
                        {totalSurplus > 0 && <p className="font-bold text-emerald-700">+{sqft(totalSurplus)}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop summary table */}
              <div className="hidden min-w-0 overflow-x-auto sm:block">
                <table className="w-full border-collapse text-left text-base">
                  <thead>
                    <tr className="border-b-2 border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
                      <th className="px-4 py-3">Marble</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Ownership</th>
                      <th className="px-4 py-3">Landed price</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Loss / surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inStock.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No stock on hand</td>
                      </tr>
                    )}
                    {inStock.map((p) => {
                      const adj = adjMap[p.id] || { loss: 0, surplus: 0 };
                      return (
                        <tr key={p.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60">
                          <td className="px-4 py-3.5 align-top">
                            <p className="font-semibold text-zinc-900">{p.name}</p>
                            <p className="mt-0.5 font-mono text-sm text-zinc-500">{p.dimension}</p>
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums font-semibold text-zinc-900">{sqft(p.stock, p.unit)}</td>
                          <td className="px-4 py-3.5 align-top">
                            <ul className="space-y-1 text-sm leading-snug text-zinc-700">
                              {ownershipLines(p).map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums text-zinc-800">
                            <div className="font-medium">{money(p.costPrice)}</div>
                            {(p.costFreight > 0 || p.costLoss > 0) && (
                              <div className="mt-0.5 text-sm leading-tight text-zinc-500">
                                {money(p.costActual || 0)}
                                {p.costFreight > 0 && <> · frt {money(p.costFreight)}</>}
                                {p.costLoss > 0 && <> · loss {money(p.costLoss)}</>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums font-bold text-zinc-900">{money(p.stock * p.costPrice)}</td>
                          <td className="px-4 py-3.5 align-top text-sm tabular-nums">
                            {adj.loss || adj.surplus ? (
                              <div className="space-y-0.5">
                                {adj.loss > 0 && <p className="font-semibold text-red-700">−{sqft(adj.loss, p.unit)}</p>}
                                {adj.surplus > 0 && <p className="font-semibold text-emerald-700">+{sqft(adj.surplus, p.unit)}</p>}
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {inStock.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-zinc-300 bg-zinc-50">
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-sm font-bold uppercase tracking-wide text-zinc-700">Total</p>
                            <p className="mt-0.5 text-sm text-zinc-500">{inStock.length} SKUs</p>
                          </td>
                          <td className="px-4 py-3.5 align-top tabular-nums text-lg font-bold text-zinc-900">
                            {sqft(totalStock)}
                          </td>
                          <td className="px-4 py-3.5 align-top text-sm text-zinc-400">—</td>
                          <td className="px-4 py-3.5 align-top text-sm text-zinc-400">—</td>
                          <td className="px-4 py-3.5 align-top tabular-nums text-lg font-bold text-zinc-900">
                            {money(totalValue)}
                          </td>
                          <td className="px-4 py-3.5 align-top text-sm tabular-nums">
                            <div className="space-y-0.5">
                              {totalLoss > 0 && <p className="font-bold text-red-700">−{sqft(totalLoss)}</p>}
                              {totalSurplus > 0 && <p className="font-bold text-emerald-700">+{sqft(totalSurplus)}</p>}
                              {!totalLoss && !totalSurplus && <span className="text-zinc-400">—</span>}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
