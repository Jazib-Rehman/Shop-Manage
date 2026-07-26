"use client";

import { useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import type { Marble } from "@/lib/types";
import { useShop } from "@/lib/store";

const PRESETS = ['4"x12"', '6"x12"', '12"x12"', '12"x24"', '12"x48"', '2"', '3"'];

export default function CatalogPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Marble | null>(null);
  const [name, setName] = useState("");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [dimInput, setDimInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shop.ready) return <p className="text-base text-zinc-600">Loading…</p>;

  const openNew = () => {
    setEditing(null);
    setName("");
    setDimensions([]);
    setWeights({});
    setDimInput("");
    setError("");
  };

  const openEdit = (m: Marble) => {
    setEditing(m);
    setName(m.name);
    setDimensions([...m.dimensions]);
    setWeights(
      Object.fromEntries(
        m.dimensions.map((d) => [
          d,
          String(
            (m.dimensionWeights ?? []).find((w) => w.dimension === d)?.sqFtPerTon ||
              ""
          ),
        ])
      )
    );
    setDimInput("");
    setError("");
  };

  const addDim = (raw: string) => {
    const d = raw.trim();
    if (!d || dimensions.includes(d)) return;
    setDimensions((prev) => [...prev, d]);
    setDimInput("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await shop.saveMarble({
        id: editing?.id,
        name: name.trim(),
        dimensions,
        dimensionWeights: dimensions.map((dimension) => ({
          dimension,
          sqFtPerTon: Number(weights[dimension]) || 0,
        })),
      });
      openNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (m: Marble) => {
    if (!(await confirm(`Delete “${m.name}” and its empty size SKUs?`))) return;
    try {
      await shop.deleteMarble(m.id);
      if (editing?.id === m.id) openNew();
    } catch (err) {
      await alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-11 sm:w-11">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden>
            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
            <path d="M12 12 4 7" />
            <path d="m12 12 8-5" />
            <path d="M12 12v9" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Marbles</h1>
          <p className="mt-1 text-sm text-zinc-600 sm:text-base">
            Names, sizes &amp; weight (sq ft/ton). Stock is in square feet.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:gap-6">
        <div className="order-2 space-y-3 lg:order-1">
          {shop.marbles.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-base text-zinc-500 sm:py-12">
              No marbles yet — add one above.
            </p>
          )}
          {shop.marbles.map((m) => (
            <article
              key={m.id}
              className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm transition sm:p-5 ${editing?.id === m.id ? "border-teal-600 ring-2 ring-teal-600/20" : "border-zinc-300"
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">{m.name}</h2>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {m.dimensions.length} size{m.dimensions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    onClick={() => openEdit(m)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                    onClick={() => onDelete(m)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                {m.dimensions.length === 0 && (
                  <span className="text-base text-zinc-500">No dimensions</span>
                )}
                {m.dimensions.map((d) => {
                  const w = (m.dimensionWeights ?? []).find((x) => x.dimension === d)?.sqFtPerTon;
                  return (
                    <span
                      key={d}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 ring-1 ring-zinc-200 sm:px-3"
                    >
                      <span className="font-mono text-sm font-semibold text-zinc-900">{d}</span>
                      <span className="text-sm text-zinc-600">{w || "—"} ft/ton</span>
                    </span>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <form
          onSubmit={onSubmit}
          className="order-1 h-fit space-y-5 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5 lg:order-2 lg:sticky lg:top-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-teal-700" aria-hidden>
                {editing ? (
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                ) : (
                  <>
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </>
                )}
              </svg>
              {editing ? "Edit marble" : "Add marble"}
            </h2>
            {editing && (
              <button type="button" className="text-sm font-semibold text-zinc-600 hover:underline" onClick={openNew}>
                New instead
              </button>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-zinc-800">Name</span>
            <input
              className="input text-base"
              placeholder="e.g. Sunny White"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <div className="space-y-2.5">
            <span className="text-sm font-semibold text-zinc-800">Sizes</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={dimensions.includes(p)}
                  onClick={() => addDim(p)}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1.5 font-mono text-sm font-medium text-zinc-700 hover:border-teal-600 hover:bg-teal-50 hover:text-teal-900 disabled:opacity-30"
                >
                  + {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input text-base"
                placeholder='Custom e.g. 12"x36"'
                value={dimInput}
                onChange={(e) => setDimInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDim(dimInput);
                  }
                }}
              />
              <button type="button" className="btn shrink-0" onClick={() => addDim(dimInput)}>
                Add
              </button>
            </div>

            {dimensions.length > 0 && (
              <div className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-teal-700" aria-hidden>
                    <path d="M6 3 3 9h18l-3-6Z" />
                    <path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" />
                  </svg>
                  Weight — sq ft per ton
                </p>
                {dimensions.map((d) => (
                  <div key={d} className="flex min-w-0 items-center gap-2">
                    <span className="w-16 shrink-0 truncate font-mono text-sm font-semibold text-zinc-900 sm:w-20">{d}</span>
                    <input
                      className="input min-w-0 flex-1 text-base"
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="e.g. 1000"
                      value={weights[d] ?? ""}
                      onChange={(e) =>
                        setWeights((prev) => ({ ...prev, [d]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setDimensions((prev) => prev.filter((x) => x !== d))}
                      className="shrink-0 rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${d}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-base font-medium text-red-700">{error}</p>}

          <button type="submit" className="btn w-full text-base" disabled={saving}>
            {saving ? "Saving…" : editing ? "Update marble" : "Create marble"}
          </button>
        </form>
      </div>
    </div>
  );
}
