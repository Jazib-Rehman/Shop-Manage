"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { productLabel } from "@/lib/types";

type Props = {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
};

export function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "Search marble · size…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => productLabel(p).toLowerCase().includes(s));
  }, [products, q]);

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
        className="input flex w-full items-center justify-between gap-2 text-left text-base"
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
      >
        <span className={selected ? "truncate font-medium text-zinc-900" : "truncate text-zinc-500"}>
          {selected ? productLabel(selected) : placeholder}
        </span>
        <span className="text-zinc-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-lg">
          <div className="border-b border-zinc-200 p-2">
            <input
              autoFocus
              className="input text-base"
              placeholder="Type to search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1 text-base">
            {filtered.length === 0 && (
              <li className="px-3 py-2.5 text-zinc-500">No matches</li>
            )}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`flex w-full items-center px-3 py-2.5 text-left hover:bg-teal-50 ${
                    p.id === value ? "bg-teal-50 font-semibold text-teal-900" : "text-zinc-800"
                  }`}
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="ml-auto pl-3 font-mono text-sm text-zinc-600">{p.dimension}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* native required for form validation */}
      <input tabIndex={-1} className="sr-only" value={value} required readOnly aria-hidden />
    </div>
  );
}
