export type PaymentStatus = "paid" | "partial" | "unpaid";

export function paymentStatusFrom(amountPaid: number, total: number): PaymentStatus {
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid >= total - 1e-9) return "paid";
  return "partial";
}

export function remainingBalance(total: number, amountPaid: number) {
  return Math.max(0, total - amountPaid);
}
