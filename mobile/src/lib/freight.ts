/** Tons for a line: sq ft ÷ (sq ft per ton). */
export function lineTons(qty: number, sqFtPerTon: number) {
  const rate = Number(sqFtPerTon) || 0;
  return rate > 0 ? (Number(qty) || 0) / rate : 0;
}

/** Combined Rs/ton (truck + loading + unloading). */
export function ratePerTon(truckFare: number, loadingCost: number, unloadingCost: number) {
  return (Number(truckFare) || 0) + (Number(loadingCost) || 0) + (Number(unloadingCost) || 0);
}

/** Freight Rs per sq ft = rate/ton ÷ sq ft per ton. */
export function freightPerSqFt(perTon: number, sqFtPerTon: number) {
  const rate = Number(sqFtPerTon) || 0;
  return rate > 0 ? (Number(perTon) || 0) / rate : 0;
}
