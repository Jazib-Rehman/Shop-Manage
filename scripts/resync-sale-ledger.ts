/**
 * Rebuild partner sale_share rows as profit × income%.
 *
 *   npx tsx --env-file=.env scripts/resync-sale-ledger.ts
 */
import { db } from "../src/lib/db";
import { syncSaleLedger } from "../src/lib/partner-ledger";
import { Product } from "../src/models/Product";
import { Sale } from "../src/models/Sale";

async function main() {
  await db();
  const sales = await Sale.find().lean();
  console.log(`Resyncing ${sales.length} sale(s)…`);
  for (const s of sales) {
    const product = await Product.findById(s.productId).lean();
    if (!product) continue;
    const allocations = (s.allocations ?? []).map(
      (a: { partnerId?: unknown; qty: number }) => ({
        partnerId: a.partnerId ? String(a.partnerId) : null,
        qty: a.qty,
      })
    );
    await syncSaleLedger({
      userId: String(s.userId),
      saleId: String(s._id),
      productId: String(product._id),
      unitPrice: s.unitPrice,
      costPrice: product.costPrice,
      allocations,
      label: `${product.name} · ${product.dimension}`,
    });
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
