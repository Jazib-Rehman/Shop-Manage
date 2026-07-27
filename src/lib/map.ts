/* eslint-disable @typescript-eslint/no-explicit-any */
import { paymentStatusFrom } from "./payment";

export function mapPartnerLedger(d: any) {
  return {
    id: String(d._id),
    partnerId: String(d.partnerId),
    type: d.type,
    amount: d.amount,
    qty: d.qty ?? 0,
    saleId: d.saleId ? String(d.saleId) : null,
    purchaseId: d.purchaseId ? String(d.purchaseId) : null,
    productId: d.productId ? String(d.productId) : null,
    note: d.note ?? "",
    date: (d.createdAt as Date).toISOString(),
  };
}

export function mapPartner(d: any) {
  return {
    id: String(d._id),
    name: d.name,
    phone: d.phone ?? "",
    incomePercent: d.incomePercent ?? 100,
  };
}

export function mapCustomer(d: any) {
  return {
    id: String(d._id),
    name: d.name,
    phone: d.phone,
  };
}

export function mapMarble(d: any) {
  return {
    id: String(d._id),
    name: d.name,
    dimensions: d.dimensions ?? [],
    dimensionWeights: (d.dimensionWeights ?? []).map((w: any) => ({
      dimension: w.dimension,
      sqFtPerTon: Number(w.sqFtPerTon ?? w.tonsPerSqFt) || 0,
    })),
  };
}

export function mapProduct(d: any) {
  const costPrice = Number(d.costPrice) || 0;
  const costActual = Number(d.costActual) || 0;
  const costFreight = Number(d.costFreight) || 0;
  const costLoss = Number(d.costLoss) || 0;
  const hasBreakdown = costActual > 0 || costFreight > 0 || costLoss > 0;
  return {
    id: String(d._id),
    marbleId: String(d.marbleId),
    name: d.name,
    dimension: d.dimension,
    sqFtPerTon: Number(d.sqFtPerTon ?? d.tonsPerSqFt) || 0,
    sku: d.sku,
    stock: d.stock,
    costPrice,
    costActual: hasBreakdown ? costActual : costPrice,
    costFreight,
    costLoss,
    sellPrice: d.sellPrice,
    lowStockAt: d.lowStockAt,
    shares: (d.shares ?? []).map((s: any) => ({
      partnerId: String(s.partnerId),
      percent: Number(s.percent) || 0,
    })),
  };
}

export function mapPurchase(d: any) {
  return {
    id: String(d._id),
    productId: String(d.productId),
    qty: d.qty,
    unitCost: Number(d.unitCost) || 0,
    total: d.total,
    description: d.description ?? "",
    tripId: d.tripId ? String(d.tripId) : null,
    date: (d.createdAt as Date).toISOString(),
  };
}

export function mapTrip(d: any, lines: any[] = [], tons = 0) {
  const truckFare = Number(d.truckFare) || 0;
  const loadingCost = Number(d.loadingCost) || 0;
  const unloadingCost = Number(d.unloadingCost) || 0;
  const perTon = truckFare + loadingCost + unloadingCost;
  return {
    id: String(d._id),
    note: d.note ?? "",
    truckFare,
    loadingCost,
    unloadingCost,
    /** Total freight = (truck+loading+unloading Rs/ton) × trip tons */
    expensesTotal: perTon * tons,
    tons,
    date: (d.createdAt as Date).toISOString(),
    lines: lines.map(mapPurchase),
  };
}

export function mapSale(d: any) {
  const total = Number(d.total) || 0;
  const payments = (d.payments ?? []).map((p: any) => ({
    id: String(p._id),
    amount: p.amount,
    note: p.note ?? "",
    paidAt: new Date(p.paidAt ?? Date.now()).toISOString(),
  }));
  const fromPayments = payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  let amountPaid = Number(d.amountPaid) || 0;
  if (fromPayments > amountPaid) amountPaid = fromPayments;
  // Legacy: status "paid" but amountPaid never stored
  if (d.paymentStatus === "paid" && amountPaid <= 0 && total > 0) {
    amountPaid = total;
  }
  const paymentStatus = paymentStatusFrom(amountPaid, total);

  return {
    id: String(d._id),
    productId: String(d.productId),
    qty: d.qty,
    unitPrice: d.unitPrice,
    total,
    costTotal: d.costTotal,
    profit: d.profit,
    description: d.description ?? "",
    paymentStatus,
    amountPaid,
    payments,
    allocations: (d.allocations ?? []).map((a: any) => ({
      partnerId: a.partnerId ? String(a.partnerId) : null,
      qty: Number(a.qty) || 0,
    })),
    customerId: d.customerId ? String(d.customerId) : null,
    dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
    paidAt: d.paidAt ? new Date(d.paidAt).toISOString() : null,
    date: (d.createdAt as Date).toISOString(),
  };
}

export function mapExpense(d: any) {
  return {
    id: String(d._id),
    category: d.category ?? "",
    amount: Number(d.amount) || 0,
    description: d.description ?? d.note ?? "",
    spentAt: new Date(d.spentAt ?? d.createdAt).toISOString(),
    date: (d.createdAt as Date).toISOString(),
  };
}
