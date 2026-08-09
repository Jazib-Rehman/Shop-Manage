"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useAlert } from "@/components/Alert";
import type { Marble } from "@/lib/types";
import { useShop } from "@/lib/store";

export default function CatalogPage() {
  const shop = useShop();
  const { alert, confirm } = useAlert();
  const [editing, setEditing] = useState<Marble | null>(null);
  const [name, setName] = useState("");
  const [sizeIds, setSizeIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const sizeById = useMemo(
    () => new Map(shop.sizes.map((s) => [s.id, s])),
    [shop.sizes]
  );

  const available = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = shop.sizes.filter((s) => !sizeIds.includes(s.id));
    if (!q) return list;
    return list.filter((s) => s.label.toLowerCase().includes(q));
  }, [shop.sizes, sizeIds, filter]);

  if (!shop.ready) return <p className="text-base text-zinc-600">Loading…</p>;

  const openNew = () => {
    setEditing(null);
    setName("");
    setSizeIds([]);
    setFilter("");
    setError("");
  };

  const openEdit = (m: Marble) => {
    setEditing(m);
    setName(m.name);
    setSizeIds([...(m.sizeIds?.length ? m.sizeIds : [])]);
    // Fallback for legacy marbles without sizeIds yet
    if (!m.sizeIds?.length && m.dimensions?.length) {
      const ids = m.dimensions
        .map((d) => shop.sizes.find((s) => s.label === d)?.id)
        .filter(Boolean) as string[];
      setSizeIds(ids);
    }
    setFilter("");
    setError("");
  };

  const toggleSize = (id: string) => {
    setSizeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
        sizeIds,
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

  const chipMeta = (m: Marble) => {
    if (m.sizeIds?.length) {
      return m.sizeIds.map((id) => {
        const s = sizeById.get(id);
        return s
          ? {
              key: id,
              label: s.label,
              hint:
                s.unit === "piece"
                  ? s.sqFtPerTon
                    ? `${s.sqFtPerTon} pcs/ton`
                    : "piece"
                  : s.sqFtPerTon
                    ? `${s.sqFtPerTon} ft/ton`
                    : "sq ft",
            }
          : { key: id, label: "?", hint: "" };
      });
    }
    return m.dimensions.map((d) => {
      const w = (m.dimensionWeights ?? []).find((x) => x.dimension === d)?.sqFtPerTon;
      return { key: d, label: d, hint: w ? `${w} ft/ton` : "" };
    });
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
            Attach sizes from the{" "}
            <Link href="/sizes" className="font-semibold text-teal-800 hover:underline">
              Sizes
            </Link>{" "}
            library
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:gap-6">
        <div className="order-2 space-y-3 lg:order-1">
          {shop.marbles.length === 0 && (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-base text-zinc-500 sm:py-12">
              No marbles yet — add one on the right.
            </p>
          )}
          {shop.marbles.map((m) => (
            <article
              key={m.id}
              className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm transition sm:p-5 ${
                editing?.id === m.id ? "border-teal-600 ring-2 ring-teal-600/20" : "border-zinc-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                    {m.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-zinc-600">
                    {(m.sizeIds?.length || m.dimensions.length)} size
                    {(m.sizeIds?.length || m.dimensions.length) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-50"
                    onClick={() => openEdit(m)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                    onClick={() => onDelete(m)}
                  >
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">Del</span>
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                {chipMeta(m).length === 0 && (
                  <span className="text-base text-zinc-500">No sizes attached</span>
                )}
                {chipMeta(m).map((c) => (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 ring-1 ring-zinc-200 sm:px-3"
                  >
                    <span className="font-mono text-sm font-semibold text-zinc-900">{c.label}</span>
                    {c.hint && <span className="text-sm text-zinc-600">{c.hint}</span>}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <form
          onSubmit={onSubmit}
          className="order-1 h-fit space-y-5 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-5 lg:order-2 lg:sticky lg:top-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-800">Attach sizes</span>
              <Link href="/sizes" className="text-sm font-semibold text-teal-800 hover:underline">
                Manage sizes
              </Link>
            </div>

            {shop.sizes.length === 0 ? (
              <p className="rounded-lg bg-zinc-50 px-3 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
                No sizes yet.{" "}
                <Link href="/sizes" className="font-semibold text-teal-800 hover:underline">
                  Create sizes
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                {sizeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sizeIds.map((id) => {
                      const s = sizeById.get(id);
                      if (!s) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleSize(id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-sm font-semibold text-teal-900 ring-1 ring-teal-200"
                        >
                          <span className="font-mono">{s.label}</span>
                          <span className="text-teal-700/80">×</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  className="input text-base"
                  placeholder="Filter sizes…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />

                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl bg-zinc-50 p-2 ring-1 ring-zinc-200">
                  {available.length === 0 && (
                    <p className="px-2 py-3 text-center text-sm text-zinc-500">
                      {sizeIds.length === shop.sizes.length ? "All sizes attached" : "No matches"}
                    </p>
                  )}
                  {available.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSize(s.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-white"
                    >
                      <span className="font-mono text-sm font-semibold text-zinc-900">{s.label}</span>
                      <span className="shrink-0 text-xs font-medium text-zinc-500">
                        {s.unit === "piece"
                          ? `${s.sqFtPerTon || "—"} pcs/ton`
                          : `${s.sqFtPerTon || "—"} ft/ton`}
                      </span>
                    </button>
                  ))}
                </div>
              </>
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
