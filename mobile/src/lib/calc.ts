import type { Product, Purchase, Sale } from "./types";

export const money = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Quantity is always square feet. */
export const sqft = (n: number) =>
  `${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })} sq ft`;

export function calcStats(products: Product[], sales: Sale[], purchases: Purchase[]) {
  const outstanding = sales.filter((x) => x.paymentStatus !== "paid");
  return {
    stockValue: products.reduce((s, p) => s + p.stock * p.costPrice, 0),
    retailValue: products.reduce((s, p) => s + p.stock * p.sellPrice, 0),
    revenue: sales.reduce((s, x) => s + x.total, 0),
    profit: sales.reduce((s, x) => s + x.profit, 0),
    purchaseSpend: purchases.reduce((s, x) => s + x.total, 0),
    lowStock: products.filter((p) => p.stock <= p.lowStockAt),
    unitsInStock: products.reduce((s, p) => s + p.stock, 0),
    receivables: outstanding.reduce((s, x) => s + Math.max(0, x.total - (x.amountPaid || 0)), 0),
    collected: sales.reduce((s, x) => s + (x.amountPaid || 0), 0),
    unpaid: outstanding,
  };
}

export const dayKey = (iso: string) => iso.slice(0, 10);

export function lastNDays(n: number) {
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
