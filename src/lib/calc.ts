import type { Customer, Product, Sale, Purchase, SizeUnit } from "./types";

export const money = (n: number) =>
  `Rs ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

export type QtyUnit = SizeUnit | null | undefined;

/** "sq ft" | "piece" */
export function unitWord(unit?: QtyUnit, plural = false) {
  if (unit === "piece") return plural ? "pieces" : "piece";
  return "sq ft";
}

/** "ft" | "pc" — short suffix for "/ft" style labels */
export function unitShort(unit?: QtyUnit) {
  return unit === "piece" ? "pc" : "ft";
}

/** "pcs" | "sq ft" — quantity suffix */
export function unitSuffix(unit?: QtyUnit) {
  return unit === "piece" ? "pcs" : "sq ft";
}

export function pricePerLabel(unit?: QtyUnit) {
  return unit === "piece" ? "Price / piece" : "Price / ft";
}

export function costPerLabel(unit?: QtyUnit) {
  return unit === "piece" ? "Cost / piece" : "Cost / sq ft";
}

export function profitPerLabel(unit?: QtyUnit) {
  return unit === "piece" ? "Profit / piece" : "Profit / sq ft";
}

export function qtyLabel(unit?: QtyUnit) {
  return unit === "piece" ? "Qty (pieces)" : "Qty (sq ft)";
}

/** Format a quantity with the product's unit. */
export const qty = (n: number, unit?: QtyUnit) =>
  `${n.toLocaleString("en-PK", { maximumFractionDigits: 2 })} ${unitSuffix(unit)}`;

/** Alias — pass product.unit when known. */
export const sqft = (n: number, unit?: QtyUnit) => qty(n, unit);

export function calcStats(
  products: Product[],
  sales: Sale[],
  purchases: Purchase[],
  customers: Customer[] = []
) {
  const stockValue = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const retailValue = products.reduce((s, p) => s + p.stock * p.sellPrice, 0);
  const revenue = sales.reduce((s, x) => s + x.total, 0);
  const cogs = sales.reduce((s, x) => s + x.costTotal, 0);
  const profit = sales.reduce((s, x) => s + x.profit, 0);
  const purchaseSpend = purchases.reduce((s, x) => s + x.total, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockAt);
  const unitsInStock = products.reduce((s, p) => s + p.stock, 0);
  const outstanding = sales.filter((x) => x.paymentStatus !== "paid");
  const saleReceivables = outstanding.reduce(
    (s, x) => s + Math.max(0, x.total - (x.amountPaid || 0)),
    0
  );
  const arrears = customers.reduce((s, c) => s + Math.max(0, c.arrears || 0), 0);
  const receivables = saleReceivables + arrears;
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
