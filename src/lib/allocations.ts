import { mySharePercent, type Product } from "./types";

export type SaleAllocation = {
  partnerId: string | null;
  qty: number;
};

export type AllocUnit = "percent" | "sqft" | "amount";

/** Default sale/purchase split from product ownership %. */
export function defaultAllocations(
  qty: number,
  product: Pick<Product, "shares">
): SaleAllocation[] {
  const shares = product.shares ?? [];
  if (!shares.length) return [{ partnerId: null, qty }];

  const mine = mySharePercent(product);
  const rows: SaleAllocation[] = [];
  if (mine > 0) rows.push({ partnerId: null, qty: (mine / 100) * qty });
  for (const s of shares) {
    if (!(s.percent > 0)) continue;
    rows.push({ partnerId: s.partnerId, qty: (s.percent / 100) * qty });
  }
  if (!rows.length) return [{ partnerId: null, qty }];
  const sum = rows.reduce((a, r) => a + r.qty, 0);
  const diff = qty - sum;
  if (Math.abs(diff) > 1e-9) rows[0].qty += diff;
  return rows.map((r) => ({ ...r, qty: Math.round(r.qty * 1000) / 1000 }));
}

export function validateAllocations(qty: number, allocations: SaleAllocation[]) {
  const sum = allocations.reduce((s, a) => s + (Number(a.qty) || 0), 0);
  if (Math.abs(sum - qty) > 0.02) {
    return `Allocations (${sum}) must equal qty (${qty})`;
  }
  if (allocations.some((a) => a.qty < 0)) return "Allocation qty cannot be negative";
  return null;
}

/** Display value for an allocation qty. */
export function allocDisplay(qty: number, unit: AllocUnit, totalQty: number, unitMoney: number) {
  if (unit === "sqft") return qty;
  if (unit === "percent") return totalQty > 0 ? (qty / totalQty) * 100 : 0;
  return qty * unitMoney;
}

/** Convert typed value → allocation qty. */
export function allocFromInput(
  value: number,
  unit: AllocUnit,
  totalQty: number,
  unitMoney: number
) {
  if (unit === "sqft") return value;
  if (unit === "percent") return totalQty > 0 ? (value / 100) * totalQty : 0;
  return unitMoney > 0 ? value / unitMoney : 0;
}

/** Blend purchase allocations into existing product ownership %. */
export function mergeOwnershipShares(
  oldStock: number,
  oldShares: { partnerId: string; percent: number }[],
  addQty: number,
  allocations: SaleAllocation[]
) {
  const owned = new Map<string, number>();
  for (const s of oldShares) {
    if (!s.partnerId || !(s.percent > 0)) continue;
    owned.set(String(s.partnerId), (s.percent / 100) * Math.max(0, oldStock));
  }
  for (const a of allocations) {
    if (!a.partnerId || !(a.qty > 0)) continue;
    owned.set(a.partnerId, (owned.get(a.partnerId) || 0) + a.qty);
  }
  const total = Math.max(0, oldStock) + addQty;
  if (total <= 1e-9) return [];
  return [...owned.entries()]
    .map(([partnerId, q]) => ({
      partnerId,
      percent: Math.round((q / total) * 10000) / 100,
    }))
    .filter((s) => s.percent > 0);
}
