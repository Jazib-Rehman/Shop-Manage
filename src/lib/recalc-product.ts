import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import { StockAdjustment } from "@/models/StockAdjustment";
import { Trip } from "@/models/Trip";
import { freightPerSqFt, ratePerTon } from "@/lib/freight";

/** Rebuild stock + cost breakdown. Freight from trips; loss from adjustments. */
export async function recalcProduct(productId: string) {
  const [purchases, sales, adjustments, product] = await Promise.all([
    Purchase.find({ productId }).lean(),
    Sale.find({ productId }).lean(),
    StockAdjustment.find({ productId }).lean(),
    Product.findById(productId),
  ]);
  if (!product) return null;

  const tripIds = [
    ...new Set(purchases.filter((p) => p.tripId).map((p) => String(p.tripId))),
  ];
  const trips = tripIds.length
    ? await Trip.find({ _id: { $in: tripIds } }).lean()
    : [];
  const tripRate = new Map(
    trips.map((t) => [
      String(t._id),
      ratePerTon(t.truckFare || 0, t.loadingCost || 0, t.unloadingCost || 0),
    ])
  );
  const sqFtPerTon =
    Number(
      (product as { sqFtPerTon?: number; tonsPerSqFt?: number }).sqFtPerTon ??
        (product as { tonsPerSqFt?: number }).tonsPerSqFt
    ) || 0;
  const freightOf = (p: { tripId?: unknown }) => {
    if (!p.tripId) return 0;
    return freightPerSqFt(tripRate.get(String(p.tripId)) || 0, sqFtPerTon);
  };

  type Ev = {
    at: number;
    kind: "purchase" | "sale" | "loss" | "surplus";
    qty: number;
    actual?: number;
    freight?: number;
  };

  const events: Ev[] = [
    ...purchases.map((p) => ({
      at: new Date(p.createdAt as Date).getTime(),
      kind: "purchase" as const,
      qty: p.qty,
      actual: Number(p.unitCost) || 0,
      freight: freightOf(p),
    })),
    ...sales.map((s) => ({
      at: new Date(s.createdAt as Date).getTime(),
      kind: "sale" as const,
      qty: s.qty,
    })),
    ...adjustments.map((a) => ({
      at: new Date(a.createdAt as Date).getTime(),
      kind: a.type as "loss" | "surplus",
      qty: a.qty,
    })),
  ].sort((a, b) => a.at - b.at);

  let stock = 0;
  let actualV = 0;
  let freightV = 0;
  let lossV = 0;

  for (const e of events) {
    if (e.kind === "purchase") {
      stock += e.qty;
      actualV += e.qty * (e.actual || 0);
      freightV += e.qty * (e.freight || 0);
      continue;
    }
    if (e.kind === "sale") {
      if (stock > 1e-9) {
        const r = Math.min(e.qty, stock) / stock;
        actualV *= 1 - r;
        freightV *= 1 - r;
        lossV *= 1 - r;
      }
      stock = Math.max(0, stock - e.qty);
      continue;
    }
    if (e.kind === "loss") {
      if (e.qty > stock + 1e-9) return { error: "Stock would go negative" as const };
      if (stock > 1e-9) {
        const r = e.qty / stock;
        const absorbed = (actualV + freightV + lossV) * r;
        actualV *= 1 - r;
        freightV *= 1 - r;
        lossV *= 1 - r;
        lossV += absorbed;
      }
      stock -= e.qty;
      continue;
    }
    stock += e.qty;
  }

  if (stock < -1e-9) return { error: "Stock would go negative" as const };

  const soldQty = sales.reduce((s, x) => s + x.qty, 0);
  const sellSum = sales.reduce((s, x) => s + x.qty * x.unitPrice, 0);
  const value = actualV + freightV + lossV;

  await Product.collection.updateOne(
    { _id: product._id },
    {
      $set: {
        stock: Math.max(0, stock),
        costActual: stock > 1e-9 ? actualV / stock : 0,
        costFreight: stock > 1e-9 ? freightV / stock : 0,
        costLoss: stock > 1e-9 ? lossV / stock : 0,
        costPrice: stock > 1e-9 ? value / stock : 0,
        sellPrice: soldQty > 0 ? sellSum / soldQty : 0,
        soldQty,
      },
    }
  );

  return { product: (await Product.findById(productId))! };
}
