"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Customer } from "@/lib/types";
import { customerLabel } from "@/lib/types";

type Props = {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (c: Customer) => void;
};

export function CustomerSelect({ customers, value, onChange, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(s) || c.phone.includes(s)
    );
  }, [customers, q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const create = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onCreated(data);
      onChange(data.id);
      setCreating(false);
      setOpen(false);
      setName("");
      setPhone("");
      setQ("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
          setCreating(false);
        }}
      >
        <span className={selected ? "truncate text-zinc-900" : "truncate text-zinc-400"}>
          {selected ? customerLabel(selected) : "Select customer…"}
        </span>
        <span className="text-zinc-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          {!creating ? (
            <>
              <div className="border-b border-zinc-100 p-2">
                <input
                  autoFocus
                  className="input"
                  placeholder="Search name or phone…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <ul className="max-h-44 overflow-auto py-1 text-sm">
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-zinc-400">No matches</li>
                )}
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`flex w-full flex-col px-3 py-2 text-left hover:bg-teal-50 ${
                        c.id === value ? "bg-teal-50" : ""
                      }`}
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-zinc-500">{c.phone}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 p-2">
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-teal-800 hover:bg-teal-50"
                  onClick={() => {
                    setCreating(true);
                    setName(q);
                    setError("");
                  }}
                >
                  + New customer
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2 p-3">
              <p className="text-sm font-medium text-zinc-800">New customer</p>
              <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn flex-1" disabled={saving} onClick={create}>
                  {saving ? "Saving…" : "Create & select"}
                </button>
                <button type="button" className="rounded-lg px-3 text-sm text-zinc-600 hover:bg-zinc-100" onClick={() => setCreating(false)}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <input tabIndex={-1} className="sr-only" value={value} readOnly aria-hidden />
    </div>
  );
}
