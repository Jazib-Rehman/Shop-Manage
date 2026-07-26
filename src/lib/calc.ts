import type { Product, Sale, Purchase } from "./types";

export const money = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/** Quantity is always square feet. */
export const sqft = (n: number) =>
  `${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })} sq ft`;

export function calcStats(products: Product[], sales: Sale[], purchases: Purchase[]) {
  const stockValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const retailValue = products.reduce((s, p) => s + p.stock * p.sellPrice, 0);
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const cogs = sales.reduce((s, x) => s + x.costTotal, 0);
  const profit = sales.reduce((s, x) => s + x.profit, 0);
  const purchaseSpend = purchases.reduce((s, x) => s + x.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockAt);
  const unitsInStock = products.reduce((s, p) => s + p.stock, 0);
  const outstanding = sales.filter((x) => x.paymentStatus !== "paid");
  const receivables = outstanding.reduce(
    (s, x) => s + Math.max(0, x.total - (x.amountPaid || 0)),
    0
  );
  const collected = sales.reduce((s, x) => s + (x.amountPaid || 0), 0);

  return {
    stockValue,
    retailValue,
    revenue,
    cogs,
    profit,
    purchaseSpend,
    lowStock,
    unitsInStock,
    receivables,
    collected,
    unpaid: outstanding,
  };
}
