/** Landed marble rate only (freight/loss live on the product). */
export function landedUnit(p: { unitCost: number }) {
  return Number(p.unitCost) || 0;
}
