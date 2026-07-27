export function remainingBalance(total: number, amountPaid: number) {
  return Math.max(0, total - amountPaid);
}
