import { Partner } from "@/models/Partner";
import { PartnerLedger } from "@/models/PartnerLedger";

type Alloc = { partnerId: string | null; qty: number };

/** Rebuild partner ledger sale_share rows for a sale. */
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

  for (const a of input.allocations) {
    if (!a.partnerId || a.qty <= 0) continue;
    const partner = await Partner.findOne({ _id: a.partnerId, userId: input.userId }).lean();
    const incomePct = partner?.incomePercent ?? 100;
    const revenue = a.qty * input.unitPrice;
    const cost = a.qty * input.costPrice;
    const profit = revenue - cost;
    const amount = profit * (incomePct / 100);
    await PartnerLedger.create({
      userId: input.userId,
      partnerId: a.partnerId,
      type: "sale_share",
      amount,
      qty: a.qty,
      saleId: input.saleId,
      productId: input.productId,
      note: `${input.label} · ${a.qty} sq ft · profit ${profit.toFixed(0)} × ${incomePct}%`,
    });
  }
}

export async function clearSaleLedger(saleId: string, userId: string) {
  await PartnerLedger.deleteMany({ saleId, type: "sale_share", userId });
}

/** Partner cost share for a purchase (debit from their balance). */
export async function syncPurchaseLedger(input: {
  userId: string;
  purchaseId: string;
  productId: string;
  qty: number;
  unitCost: number;
  shares: { partnerId: string; percent: number }[];
  label: string;
}) {
  await PartnerLedger.deleteMany({
    purchaseId: input.purchaseId,
    type: "purchase_share",
    userId: input.userId,
  });
  const total = input.qty * input.unitCost;

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
      note: `${input.label} · ${s.percent}% · ${qty.toFixed(2)} sq ft`,
    });
  }
}

export async function clearPurchaseLedger(purchaseId: string, userId: string) {
  await PartnerLedger.deleteMany({ purchaseId, type: "purchase_share", userId });
}
