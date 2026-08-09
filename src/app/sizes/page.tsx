"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import type { Size, SizeUnit } from "@/lib/types";
import { useShop } from "@/lib/store";

function unitLabel(u: SizeUnit) {
  return u === "piece" ? "Piece" : "Sq ft";
}

export default function SizesPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Size | null>(null);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState<SizeUnit>("sqft");
  const [sqFtPerTon, setSqFtPerTon] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return shop.sizes;
    return shop.sizes.filter(
      (x) => x.label.toLowerCase().includes(s) || x.unit.includes(s)
    );
  }, [shop.sizes, q]);

  if (!shop.ready) return <p className="text-base text-zinc-600">Loading…</p>;

  const reset = () => {
    setEditing(null);
    setLabel("");
    setUnit("sqft");
    setSqFtPerTon("");
    setError("");
  };

  const openEdit = (size: Size) => {
    setEditing(size);
    setLabel(size.label);
    setUnit(size.unit);
    setSqFtPerTon(size.sqFtPerTon ? String(size.sqFtPerTon) : "");
    setError("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveSize({
        id: editing?.id,
        label: label.trim(),
        unit,
        sqFtPerTon: Number(sqFtPerTon) || 0,
      });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (size: Size) => {
    if (!(await confirm(`Delete size “${size.label}”?`))) return;
    try {
      await shop.deleteSize(size.id);
      if (editing?.id === size.id) reset();
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
            <path d="M21 8H3" /><path d="M21 16H3" /><path d="M8 4v16" /><path d="M16 4v16" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Sizes</h1>
          <p className="mt-1 text-sm text-zinc-600 sm:text-base">
            Shared sizes for the catalog · {shop.sizes.length} defined
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:gap-6">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <label className="block space-y-1.5 rounded-xl border border-zinc-300 bg-white p-3 shadow-sm sm:max-w-md">
            <span className="text-sm font-semibold text-zinc-800">Search</span>
            <input
              className="input text-base"
              placeholder="Label or unit…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="space-y-3 md:hidden">
            {rows.length === 0 && (
              <div className="rounded-xl border border-zinc-300 bg-white px-4 py-10 text-center text-zinc-600 shadow-sm">
                {shop.sizes.length === 0 ? "No sizes yet — add one first" : "No matches"}
              </div>
            )}
            {rows.map((s) => (
              <article
                key={s.id}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  editing?.id === s.id ? "border-teal-600 ring-2 ring-teal-600/20" : "border-zinc-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-lg font-bold text-zinc-900">{s.label}</p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      {unitLabel(s.unit)}
                      {s.sqFtPerTon > 0
                        ? ` · ${s.sqFtPerTon} ${s.unit === "piece" ? "pcs" : "sq ft"}/ton`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1.5 border-t border-zinc-100 pt-3">
                  <button type="button" className="flex-1 rounded-lg py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal-200" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button type="button" className="flex-1 rounded-lg py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200" onClick={() => onDelete(s)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm md:block">
            <table className="w-full text-left text-base">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700">
                <tr>
                  <th className="px-4 py-3.5">Label</th>
                  <th className="px-4 py-3.5">Unit</th>
                  <th className="px-4 py-3.5 text-right">Per ton</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-zinc-600">
                      {shop.sizes.length === 0 ? "No sizes yet — add one first" : "No matches"}
                    </td>
                  </tr>
                )}
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">{s.label}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-sm font-semibold ring-1 ${
                        s.unit === "piece"
                          ? "bg-sky-50 text-sky-900 ring-sky-200"
                          : "bg-teal-50 text-teal-900 ring-teal-200"
                      }`}>
                        {unitLabel(s.unit)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-700">
                      {s.sqFtPerTon
                        ? `${s.sqFtPerTon} ${s.unit === "piece" ? "pcs" : "sq ft"}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm">
                      <button type="button" className="mr-1 rounded-md px-2 py-1.5 font-semibold text-teal-800 hover:bg-teal-50" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className="rounded-md px-2 py-1.5 font-semibold text-red-700 hover:bg-red-50" onClick={() => onDelete(s)}>
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
            <h2 className="text-lg font-bold text-zinc-900">
              {editing ? "Edit size" : "Add size"}
            </h2>
            {editing && (
              <button type="button" className="text-sm font-semibold text-zinc-600 hover:underline" onClick={reset}>
                New instead
              </button>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-zinc-800">Label</span>
            <input
              className="input font-mono text-base"
              placeholder='e.g. 12"x24" or 2"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-zinc-800">Unit</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["sqft", "Sq ft"],
                ["piece", "Piece"],
              ] as const).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUnit(value)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold ring-1 transition ${
                    unit === value
                      ? "bg-teal-700 text-white ring-teal-700"
                      : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-zinc-800">
              {unit === "piece" ? "Pieces per ton" : "Sq ft per ton"}
            </span>
            <input
              className="input text-base"
              type="number"
              min="0"
              step="any"
              required
              placeholder={unit === "piece" ? "e.g. 5000" : "e.g. 2500"}
              value={sqFtPerTon}
              onChange={(e) => setSqFtPerTon(e.target.value)}
            />
          </label>

          {editing && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              Unit &amp; weight updates show everywhere from here. Saved purchase/sale prices stay unchanged.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-base font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn w-full text-base" disabled={saving}>
            {saving ? "Saving…" : editing ? "Update size" : "Add size"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Then attach sizes in{" "}
            <Link href="/catalog" className="font-semibold text-teal-800 hover:underline">
              Marble catalog
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
