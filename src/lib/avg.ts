/** Weighted average: (oldQty * oldPrice + addQty * addPrice) / (oldQty + addQty) */
export function weightedAvg(oldQty: number, oldPrice: number, addQty: number, addPrice: number) {
  if (addQty <= 0) return oldPrice;
  if (oldQty <= 0) return addPrice;
  return (oldQty * oldPrice + addQty * addPrice) / (oldQty + addQty);
}
