"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { calcStats, money, sqft } from "@/lib/calc";
import { productLabel, type Trip } from "@/lib/types";
import { useShop } from "@/lib/store";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function lastNDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function Icon({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const I = {
  box: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16V9" />
      <path d="M12 16v-5" />
      <path d="M17 16V6" />
    </>
  ),
  tiles: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  cart: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L22 7H6" />
    </>
  ),
  check: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};

function Bars({
  labels,
  a,
  b,
  aLabel,
  bLabel,
}: {
  labels: string[];
  a: number[];
  b: number[];
  aLabel: string;
  bLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });
  const max = Math.max(1, ...a, ...b);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm font-medium text-zinc-700 sm:gap-5">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-teal-700" />
          {aLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-zinc-400" />
          {bLabel}
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="relative flex h-44 min-w-[28rem] items-end gap-1.5 sm:min-w-0">
          {hover != null && (
            <div
              className="pointer-events-none fixed z-50 w-max max-w-[11rem] rounded-lg bg-zinc-900 px-2.5 py-2 text-left text-xs font-medium text-white shadow-lg"
              style={{ left: tip.x + 12, top: tip.y + 12 }}
            >
              <p className="mb-1 font-semibold text-zinc-200">
                {new Date(labels[hover] + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="tabular-nums text-teal-300">
                {aLabel}: {money(a[hover])}
              </p>
              <p className="tabular-nums text-zinc-300">
                {bLabel}: {money(b[hover])}
              </p>
            </div>
          )}
          {labels.map((lab, i) => (
            <div
              key={lab}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
              onClick={() => setHover((h) => (h === i ? null : i))}
              onTouchStart={(e) => {
                const t = e.touches[0];
                setTip({ x: t.clientX, y: t.clientY });
                setHover((h) => (h === i ? null : i));
              }}
            >
              <div className="flex h-36 w-full cursor-pointer items-end justify-center gap-0.5">
                <div
                  className="w-1/2 max-w-[16px] rounded-t bg-teal-700"
                  style={{ height: `${(a[i] / max) * 100}%`, minHeight: a[i] ? 3 : 0 }}
                />
                <div
                  className="w-1/2 max-w-[16px] rounded-t bg-zinc-400"
                  style={{ height: `${(b[i] / max) * 100}%`, minHeight: b[i] ? 3 : 0 }}
                />
              </div>
              <span
                className={`truncate text-[10px] font-medium sm:text-xs ${
                  hover === i ? "text-zinc-900" : "text-zinc-600"
                }`}
              >
                {lab.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const shop = useShop();
  const shotRef = useRef<HTMLDivElement>(null);
  const [snapping, setSnapping] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    fetch("/api/trips")
      .then((r) => (r.ok ? r.json() : []))
      .then(setTrips)
      .catch(() => {});
  }, []);

  const downloadShot = async () => {
    if (!shotRef.current) return;
    setSnapping(true);
    try {
      const dataUrl = await toPng(shotRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f4f6f8",
        filter: (node) => !(node instanceof HTMLElement && node.dataset.shotIgnore != null),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `shop-overview-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } finally {
      setSnapping(false);
    }
  };

  if (!shop.ready) {
    return (
      <div className="flex h-40 items-center justify-center text-base text-zinc-600">
        Loading…
      </div>
    );
  }

  const s = calcStats(shop.products, shop.sales, shop.purchases, shop.customers);
  const days = lastNDays(14);
  const salesByDay = days.map((d) =>
    shop.sales.filter((x) => dayKey(x.date) === d).reduce((sum, x) => sum + x.total, 0)
  );
  const purchasesByDay = days.map((d) =>
    shop.purchases.filter((x) => dayKey(x.date) === d).reduce((sum, x) => sum + x.total, 0)
  );

  const paidN = shop.sales.filter((x) => x.paymentStatus === "paid").length;
  const partialN = shop.sales.filter((x) => x.paymentStatus === "partial").length;
  const unpaidN = shop.sales.filter((x) => x.paymentStatus === "unpaid").length;
  const payTotal = Math.max(1, paidN + partialN + unpaidN);

  const topStock = [...shop.products].sort((a, b) => b.stock - a.stock).slice(0, 5);
  const maxStock = Math.max(1, ...topStock.map((p) => p.stock));

  const customerOf = (id: string | null) => {
    if (!id) return "Customer";
    return shop.customers.find((c) => c.id === id)?.name || "Customer";
  };

  const hero = [
    { label: "Stock value", value: money(s.stockValue), hint: "At average cost", icon: I.box },
    { label: "Receivables", value: money(s.receivables), hint: "Still owed to you", icon: I.wallet },
    { label: "Gross profit", value: money(s.profit), hint: "From all sales", icon: I.chart },
    { label: "In stock", value: sqft(s.unitsInStock), hint: `${shop.products.length} sizes`, icon: I.tiles },
  ];

  const truckTotal = trips.reduce((s, t) => s + t.truckFare * t.tons, 0);
  const loadTotal = trips.reduce((s, t) => s + (t.loadingCost + t.unloadingCost) * t.tons, 0);

  const quick = [
    { k: "Retail stock", v: money(s.retailValue), icon: I.box },
    { k: "All revenue", v: money(s.revenue), icon: I.chart },
    { k: "Purchase spend", v: money(s.purchaseSpend), icon: I.cart },
    { k: "Truck fares", v: money(truckTotal), icon: I.cart },
    { k: "Loading / unloading", v: money(loadTotal), icon: I.box },
    { k: "Partners", v: String(shop.partners.length), icon: I.users },
    { k: "Customers", v: String(shop.customers.length), icon: I.users },
    { k: "Low stock SKUs", v: String(s.lowStock.length), icon: I.alert },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div ref={shotRef} className="space-y-6 sm:space-y-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-zinc-900 px-4 py-6 text-white shadow-sm sm:px-6 sm:py-8 md:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-teal-100 sm:text-base">Shop Manager</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">Overview</h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-teal-50 sm:text-base">
                Stock, cash collected, and credit at a glance.
              </p>
            </div>
            <button
              type="button"
              data-shot-ignore
              onClick={downloadShot}
              disabled={snapping}
              title="Download snapshot"
              aria-label="Download snapshot"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 disabled:opacity-50"
            >
              <Icon className="h-5 w-5">{I.camera}</Icon>
              <span className="hidden sm:inline">{snapping ? "Saving…" : "Snapshot"}</span>
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3 lg:grid-cols-4">
            {hero.map((c) => (
              <div
                key={c.label}
                className="rounded-xl bg-white/15 px-3 py-3.5 ring-1 ring-white/25 backdrop-blur-sm sm:px-4 sm:py-4"
              >
                <div className="flex items-center gap-2 text-teal-50">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 sm:h-9 sm:w-9">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5">{c.icon}</Icon>
                  </span>
                  <p className="text-xs font-semibold sm:text-sm">{c.label}</p>
                </div>
                <p className="mt-2 break-words text-base font-bold tabular-nums tracking-tight sm:mt-3 sm:text-2xl">
                  {c.value}
                </p>
                <p className="mt-1 text-xs text-teal-100 sm:text-sm">{c.hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-10 sm:w-10">
                  <Icon>{I.chart}</Icon>
                </span>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Sales vs purchases</h2>
                  <p className="text-sm text-zinc-600">Last 14 days (Rs)</p>
                </div>
              </div>
              <div className="text-left text-sm font-medium text-zinc-700 sm:text-right">
                <p>Sales {money(salesByDay.reduce((a, n) => a + n, 0))}</p>
                <p className="text-zinc-500">Buys {money(purchasesByDay.reduce((a, n) => a + n, 0))}</p>
              </div>
            </div>
            <Bars labels={days} a={salesByDay} b={purchasesByDay} aLabel="Sales" bLabel="Purchases" />
          </section>

          <section className="min-w-0 rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 sm:h-10 sm:w-10">
                <Icon>{I.check}</Icon>
              </span>
              <div>
                <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Payment mix</h2>
                <p className="text-sm text-zinc-600">{shop.sales.length} sales total</p>
              </div>
            </div>
            <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-zinc-200">
              <div className="bg-emerald-600" style={{ width: `${(paidN / payTotal) * 100}%` }} />
              <div className="bg-sky-600" style={{ width: `${(partialN / payTotal) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(unpaidN / payTotal) * 100}%` }} />
            </div>
            <ul className="mt-5 space-y-3 text-base">
              <li className="flex justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-zinc-800">
                  <span className="h-3 w-3 rounded-sm bg-emerald-600" /> Paid
                </span>
                <span className="tabular-nums font-bold text-zinc-900">{paidN}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-zinc-800">
                  <span className="h-3 w-3 rounded-sm bg-sky-600" /> Partial
                </span>
                <span className="tabular-nums font-bold text-zinc-900">{partialN}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-zinc-800">
                  <span className="h-3 w-3 rounded-sm bg-amber-500" /> Unpaid
                </span>
                <span className="tabular-nums font-bold text-zinc-900">{unpaidN}</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-zinc-200 pt-3">
                <span className="font-medium text-zinc-700">Collected</span>
                <span className="tabular-nums text-lg font-bold text-zinc-900">{money(s.collected)}</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 sm:h-10 sm:w-10">
                  <Icon>{I.tiles}</Icon>
                </span>
                <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Top stock</h2>
              </div>
              <Link
                href="/inventory"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-800 hover:underline"
                data-shot-ignore
              >
                Inventory <Icon className="h-4 w-4">{I.arrow}</Icon>
              </Link>
            </div>
            {topStock.length === 0 ? (
              <p className="py-8 text-center text-base text-zinc-600">No products yet</p>
            ) : (
              <ul className="space-y-4">
                {topStock.map((p) => (
                  <li key={p.id}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm sm:text-base">
                      <span className="truncate font-medium text-zinc-900">{productLabel(p)}</span>
                      <span className="shrink-0 tabular-nums font-bold text-zinc-800">{sqft(p.stock, p.unit)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-teal-700"
                        style={{ width: `${(p.stock / maxStock) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 sm:h-10 sm:w-10">
                <Icon>{I.box}</Icon>
              </span>
              <h2 className="text-base font-bold text-zinc-900 sm:text-lg">Quick stats</h2>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {quick.map(({ k, v, icon }) => (
                <div key={k} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 sm:px-3.5">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 sm:text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500">{icon}</Icon>
                    {k}
                  </dt>
                  <dd className="mt-1.5 text-base font-bold tabular-nums text-zinc-900 sm:text-lg">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {s.unpaid.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-amber-800">{I.wallet}</Icon>
              <h2 className="text-lg font-bold text-amber-950">Receivables</h2>
            </div>
            <Link href="/sales" className="text-sm font-semibold text-teal-800 hover:underline">
              View sales
            </Link>
          </div>
          <ul className="divide-y divide-amber-200 overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50">
            {s.unpaid.slice(0, 6).map((sale) => {
              const p = shop.products.find((x) => x.id === sale.productId);
              return (
                <li key={sale.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zinc-900">
                      {customerOf(sale.customerId)} · {p ? productLabel(p) : "—"}
                    </p>
                    <p className="mt-0.5 text-sm text-amber-900">
                      {sale.dueDate
                        ? `Due ${new Date(sale.dueDate).toLocaleDateString()}`
                        : "No due date"}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg tabular-nums font-bold text-amber-950">
                    {money(Math.max(0, sale.total - (sale.amountPaid || 0)))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {s.lowStock.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-800">{I.alert}</Icon>
            <h2 className="text-lg font-bold text-amber-950">Low stock</h2>
          </div>
          <ul className="divide-y divide-amber-200 overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50">
            {s.lowStock.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-3.5 text-base">
                <span className="font-semibold text-zinc-900">{productLabel(p)}</span>
                <span className="tabular-nums font-bold text-amber-950">{sqft(p.stock, p.unit)} left</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
