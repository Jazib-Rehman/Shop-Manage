/**
 * Recompute product costActual / costFreight / costLoss from trips + adjustments.
 * Also strips legacy freightUnit / lossUnit off purchases.
 *
 *   npm run recalc-costs
 */
import { db } from "../src/lib/db";
import { recalcProduct } from "../src/lib/recalc-product";
import { recomputeTrip } from "../src/lib/trip";
import { Product } from "../src/models/Product";
import { Purchase } from "../src/models/Purchase";
import { Trip } from "../src/models/Trip";

async function main() {
  await db();

  await Purchase.collection.updateMany(
    {},
    { $unset: { freightUnit: "", lossUnit: "" } }
  );

  const trips = await Trip.find().select("_id");
  console.log(`Recomputing ${trips.length} trip(s)…`);
  for (const t of trips) await recomputeTrip(String(t._id));

  const products = await Product.find().select("_id name dimension");
  console.log(`Recalculating ${products.length} product(s)…`);
  for (const p of products) {
    const r = await recalcProduct(String(p._id));
    if (r?.error) {
      console.warn(`  skip ${p.name} · ${p.dimension}: ${r.error}`);
      continue;
    }
    const doc = r!.product;
    console.log(
      `  ${doc.name} · ${doc.dimension}: final=${Number(doc.costPrice).toFixed(2)} ` +
        `(actual=${Number(doc.costActual || 0).toFixed(2)} ` +
        `frt=${Number(doc.costFreight || 0).toFixed(2)} ` +
        `loss=${Number(doc.costLoss || 0).toFixed(2)})`
    );
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
