import { Partner } from "@/models/Partner";
import { PartnerLedger } from "@/models/PartnerLedger";
import { Product } from "@/models/Product";
import { unitSuffix } from "./calc";

type Alloc = { partnerId: string | null; qty: number };
type Share = { partnerId: string; percent: number };

function qtyNote(qty: number, unit?: "sqft" | "piece" | null) {
  const suffix = unit ? unitSuffix(unit) : "units";
  const n = unit === "piece" ? qty.toFixed(0) : qty.toFixed(2);
  return `${n} ${suffix}`;
}

/** Sale profit credited to partner after their income %. */
export async function syncSaleLedger(input: {
  userId: string;
  saleId: string;
  productId: string;
  unitPrice: number;
  costPrice: number;
  allocations: Alloc[];
  label: string;
}) {
  await PartnerLedger.deleteMany({
    saleId: input.saleId,
    type: "sale_share",
    userId: input.userId,
  });

  const product = await Product.findOne({ _id: input.productId, userId: input.userId }).lean();
  const unit = product?.unit as "sqft" | "piece" | undefined;

  for (const a of input.allocations) {
    if (!a.partnerId || a.qty <= 0) continue;
    const partner = await Partner.findOne({ _id: a.partnerId, userId: input.userId }).lean();
    const incomePct = partner?.incomePercent ?? 100;
    const revenue = a.qty * input.unitPrice;
    const cost = a.qty * input.costPrice;
    const profit = revenue - cost;
    const amount = Math.max(0, profit) * (incomePct / 100);
    if (amount <= 0) continue;
    await PartnerLedger.create({
      userId: input.userId,
      partnerId: a.partnerId,
      type: "sale_share",
      amount,
      qty: a.qty,
      saleId: input.saleId,
      productId: input.productId,
      note: `${input.label} · ${qtyNote(a.qty, unit)} · profit ${profit.toFixed(0)} × ${incomePct}%`,
    });
  }
}

export async function clearSaleLedger(saleId: string, userId: string) {
  await PartnerLedger.deleteMany({ saleId, type: "sale_share", userId });
}

/** Partner purchase cost → investment (does not change cash balance). */
export async function syncPurchaseLedger(input: {
  userId: string;
  purchaseId: string;
  productId: string;
  qty: number;
  unitCost: number;
  shares: Share[];
  label: string;
}) {
  await PartnerLedger.deleteMany({
    purchaseId: input.purchaseId,
    type: "purchase_share",
    userId: input.userId,
  });
  const total = input.qty * input.unitCost;

  const product = await Product.findOne({ _id: input.productId, userId: input.userId }).lean();
  const unit = product?.unit as "sqft" | "piece" | undefined;

  for (const s of input.shares) {
    if (!s.partnerId || s.percent <= 0) continue;
    const qty = (s.percent / 100) * input.qty;
    const amount = (s.percent / 100) * total;
    if (amount <= 0) continue;
    await PartnerLedger.create({
      userId: input.userId,
      partnerId: s.partnerId,
      type: "purchase_share",
      amount,
      qty,
      purchaseId: input.purchaseId,
      productId: input.productId,
      note: `${input.label} · investment ${s.percent}% · ${qtyNote(qty, unit)}`,
    });
  }
}

export async function clearPurchaseLedger(purchaseId: string, userId: string) {
  await PartnerLedger.deleteMany({
    purchaseId,
    type: { $in: ["purchase_share", "freight_share"] },
    userId,
  });
}

/** Trip freight on a purchase line → investment (does not change cash balance). */
export async function syncFreightLedger(input: {
  userId: string;
  purchaseId: string;
  productId: string;
  qty: number;
  freightPerUnit: number;
  shares: Share[];
  label: string;
}) {
  await PartnerLedger.deleteMany({
    purchaseId: input.purchaseId,
    type: "freight_share",
    userId: input.userId,
  });
  const total = input.qty * input.freightPerUnit;
  if (total <= 0) return;

  const product = await Product.findOne({ _id: input.productId, userId: input.userId }).lean();
  const unit = product?.unit as "sqft" | "piece" | undefined;

  for (const s of input.shares) {
    if (!s.partnerId || s.percent <= 0) continue;
    const qty = (s.percent / 100) * input.qty;
    const amount = (s.percent / 100) * total;
    if (amount <= 0) continue;
    await PartnerLedger.create({
      userId: input.userId,
      partnerId: s.partnerId,
      type: "freight_share",
      amount,
      qty,
      purchaseId: input.purchaseId,
      productId: input.productId,
      note: `${input.label} · freight ${s.percent}% · ${qtyNote(qty, unit)}`,
    });
  }
}

/** Loss/surplus on shared stock → hits partner cash balance (after income %). */
export async function syncAdjustmentLedger(input: {
  userId: string;
  adjustmentId: string;
  productId: string;
  type: "loss" | "surplus";
  qty: number;
  unitCost: number;
  label: string;
}) {
  await PartnerLedger.deleteMany({
    stockAdjustmentId: input.adjustmentId,
    userId: input.userId,
  });

  const product = await Product.findOne({ _id: input.productId, userId: input.userId }).lean();
  if (!product) return;
  const unit = product.unit as "sqft" | "piece" | undefined;
  const shares = (product.shares ?? [])
    .map((s: { partnerId: unknown; percent: number }) => ({
      partnerId: String(s.partnerId),
      percent: Number(s.percent) || 0,
    }))
    .filter((s) => s.partnerId && s.percent > 0);

  const ledgerType = input.type === "loss" ? "loss_share" : "surplus_share";
  const value = input.qty * input.unitCost;

  for (const s of shares) {
    const partner = await Partner.findOne({ _id: s.partnerId, userId: input.userId }).lean();
    const incomePct = partner?.incomePercent ?? 100;
    const qty = (s.percent / 100) * input.qty;
    const amount = (s.percent / 100) * value * (incomePct / 100);
    if (amount <= 0) continue;
    await PartnerLedger.create({
      userId: input.userId,
      partnerId: s.partnerId,
      type: ledgerType,
      amount,
      qty,
      stockAdjustmentId: input.adjustmentId,
      productId: input.productId,
      note: `${input.label} · ${input.type} ${s.percent}% · ${qtyNote(qty, unit)} × ${incomePct}%`,
    });
  }
}

export async function clearAdjustmentLedger(adjustmentId: string, userId: string) {
  await PartnerLedger.deleteMany({ stockAdjustmentId: adjustmentId, userId });
}

/** Inventory ownership allotment → partner investment (stock × cost × share %). */
export async function syncOwnershipInvestment(userId: string, productId: string) {
  await PartnerLedger.deleteMany({
    userId,
    productId,
    type: "ownership_share",
  });

  const product = await Product.findOne({ _id: productId, userId }).lean();
  if (!product) return;

  const stock = Math.max(0, Number(product.stock) || 0);
  const cost = Math.max(0, Number(product.costPrice) || 0);
  if (stock <= 0 || cost <= 0) return;

  const unit = product.unit as "sqft" | "piece" | undefined;
  const label = `${product.name} · ${product.dimension}`;
  const shares = (product.shares ?? [])
    .map((s: { partnerId: unknown; percent: number }) => ({
      partnerId: String(s.partnerId),
      percent: Number(s.percent) || 0,
    }))
    .filter((s) => s.partnerId && s.percent > 0);

  for (const s of shares) {
    const qty = (s.percent / 100) * stock;
    const amount = qty * cost;
    if (amount <= 0) continue;
    await PartnerLedger.create({
      userId,
      partnerId: s.partnerId,
      type: "ownership_share",
      amount,
      qty,
      productId,
      note: `${label} · ownership ${s.percent}% · ${qtyNote(qty, unit)} @ cost`,
    });
  }
}

