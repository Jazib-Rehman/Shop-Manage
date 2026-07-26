/**
 * Backfill partner purchase_share debits from product ownership.
 * Uses current product.shares × purchase cost (+ trip freight when linked).
 *
 *   npm run resync-purchase-ledger
 */
import { freightPerSqFt, ratePerTon } from "../src/lib/freight";
import { db } from "../src/lib/db";
import { syncPurchaseLedger } from "../src/lib/partner-ledger";
import { Product } from "../src/models/Product";
import { Purchase } from "../src/models/Purchase";
import { Trip } from "../src/models/Trip";

function rateOf(p?: { sqFtPerTon?: number; tonsPerSqFt?: number }) {
  return Number(p?.sqFtPerTon ?? p?.tonsPerSqFt) || 0;
}

async function main() {
  await db();

  const purchases = await Purchase.find().lean();
  const products = await Product.find().lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const tripIds = [
    ...new Set(
      purchases.filter((p) => p.tripId).map((p) => String(p.tripId))
    ),
  ];
  const trips = tripIds.length
    ? await Trip.find({ _id: { $in: tripIds } }).lean()
    : [];
  const tripById = new Map(trips.map((t) => [String(t._id), t]));

  let synced = 0;
  let skipped = 0;

  for (const p of purchases) {
    const product = productById.get(String(p.productId));
    if (!product) {
      skipped++;
      continue;
    }

    const shares = (product.shares ?? [])
      .map((s: { partnerId?: unknown; percent: number }) => ({
        partnerId: String(s.partnerId),
        percent: Number(s.percent) || 0,
      }))
      .filter((s: { partnerId: string; percent: number }) => s.partnerId && s.percent > 0);

    if (!shares.length) {
      skipped++;
      continue;
    }

    let unitCost = Number(p.unitCost) || 0;
    if (p.tripId) {
      const trip = tripById.get(String(p.tripId));
      if (trip) {
        unitCost += freightPerSqFt(
          ratePerTon(trip.truckFare || 0, trip.loadingCost || 0, trip.unloadingCost || 0),
          rateOf(product)
        );
      }
    }

    await syncPurchaseLedger({
      userId: String(p.userId),
      purchaseId: String(p._id),
      productId: String(product._id),
      qty: p.qty,
      unitCost,
      shares,
      label: `${product.name} · ${product.dimension}`,
    });
    synced++;
    console.log(
      `  ${product.name} · ${product.dimension}: ${p.qty} ft @ ${unitCost.toFixed(2)} → ${shares.length} partner(s)`
    );
  }

  console.log(`Done. Synced ${synced}, skipped ${skipped}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
