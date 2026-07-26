/** Loss: keep total cost value, shrink stock → avg cost rises. */
export function applyLoss(stock: number, cost: number, qty: number) {
  const total = stock * cost;
  const next = stock - qty;
  return { stock: next, costPrice: next > 1e-9 ? total / next : 0 };
}

export function reverseLoss(stock: number, cost: number, qty: number) {
  const total = stock * cost;
  const next = stock + qty;
  return { stock: next, costPrice: next > 1e-9 ? total / next : 0 };
}

export function applySurplus(stock: number, cost: number, qty: number) {
  const total = stock * cost;
  const next = stock + qty;
  return { stock: next, costPrice: next > 1e-9 ? total / next : 0 };
}

export function reverseSurplus(stock: number, cost: number, qty: number) {
  const total = stock * cost;
  const next = stock - qty;
  if (next < -1e-9) return null;
  return { stock: Math.max(0, next), costPrice: next > 1e-9 ? total / next : 0 };
}
