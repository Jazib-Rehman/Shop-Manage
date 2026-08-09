import { freightPerSqFt, ratePerTon } from "@/lib/freight";
import { syncFreightLedger, syncPurchaseLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { PartnerLedger } from "@/models/PartnerLedger";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Trip } from "@/models/Trip";

function rateOf(p?: { sqFtPerTon?: number; tonsPerSqFt?: number }) {
  return Number(p?.sqFtPerTon ?? p?.tonsPerSqFt) || 0;
}

/** Apply per-ton trip rates into product landed cost + partner ledgers. */
export async function recomputeTrip(tripId: string) {
  const trip = await Trip.findById(tripId);
  if (!trip) return;

  const lines = await Purchase.find({ tripId });
  const perTon = ratePerTon(trip.truckFare || 0, trip.loadingCost || 0, trip.unloadingCost || 0);

  const productIds = new Set(lines.map((l) => String(l.productId)));
  const products = await Product.find({ _id: { $in: [...productIds] } }).lean<{
    _id: unknown;
    name: string;
    dimension: string;
    sqFtPerTon?: number;
    tonsPerSqFt?: number;
    shares?: { partnerId: unknown; percent: number }[];
  }[]>();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const freightFor = (line: { productId: unknown }) =>
    freightPerSqFt(perTon, rateOf(productById.get(String(line.productId))));

  for (const pid of productIds) await recalcProduct(pid);

  for (const line of lines) {
    const existing = await PartnerLedger.find({
      purchaseId: String(line._id),
      type: "purchase_share",
    }).lean();
    const product = productById.get(String(line.productId));
    const shares = (
      existing.length
        ? existing.map((e) => ({
            partnerId: String(e.partnerId),
            percent: line.qty > 0 ? ((e.qty || 0) / line.qty) * 100 : 0,
          }))
        : (product?.shares ?? []).map((s) => ({
            partnerId: String(s.partnerId),
            percent: s.percent,
          }))
    ).filter((s) => s.partnerId && s.percent > 0);
    const label = product ? `${product.name} · ${product.dimension}` : "Trip line";
    const freightPerUnit = freightFor(line);
    await syncPurchaseLedger({
      userId: String(trip.userId),
      purchaseId: String(line._id),
      productId: String(line.productId),
      qty: line.qty,
      unitCost: line.unitCost,
      shares,
      label,
    });
    await syncFreightLedger({
      userId: String(trip.userId),
      purchaseId: String(line._id),
      productId: String(line.productId),
      qty: line.qty,
      freightPerUnit,
      shares,
      label,
    });
  }
}
