import { Marble } from "@/models/Marble";
import { Product } from "@/models/Product";
import { Size } from "@/models/Size";

/** Seed sizes from existing marble dimensions; backfill sizeIds / product.sizeId. */
export async function ensureSizesFromMarbles(userId: string) {
  const marbles = await Marble.find({ userId }).lean();
  let sizes = await Size.find({ userId }).lean();

  if (sizes.length === 0) {
    const byLabel = new Map<string, number>();
    for (const m of marbles) {
      for (const d of m.dimensions ?? []) {
        const label = String(d).trim();
        if (!label) continue;
        const w =
          Number(
            (m.dimensionWeights ?? []).find(
              (x: { dimension: string; sqFtPerTon?: number }) => x.dimension === label
            )?.sqFtPerTon
          ) || 0;
        if (!byLabel.has(label) || (byLabel.get(label)! <= 0 && w > 0)) {
          byLabel.set(label, w);
        }
      }
    }
    for (const [label, sqFtPerTon] of byLabel) {
      const unit = sqFtPerTon > 0 ? "sqft" : "piece";
      await Size.create({
        userId,
        label,
        unit,
        sqFtPerTon: unit === "sqft" ? sqFtPerTon : 0,
      });
    }
    sizes = await Size.find({ userId }).lean();
  }

  if (!sizes.length) return;

  const byLabel = new Map(sizes.map((s) => [s.label, String(s._id)]));
  const unitById = new Map(
    sizes.map((s) => [String(s._id), (s.unit === "piece" ? "piece" : "sqft") as "sqft" | "piece"])
  );

  for (const m of marbles) {
    const existingIds = (m.sizeIds ?? []).map(String).filter(Boolean);
    if (existingIds.length) continue;
    const sizeIds = (m.dimensions ?? [])
      .map((d: string) => byLabel.get(String(d).trim()))
      .filter(Boolean) as string[];
    if (sizeIds.length) {
      await Marble.updateOne({ _id: m._id, userId }, { $set: { sizeIds } });
    }
  }

  const products = await Product.find({
    userId,
    $or: [{ sizeId: null }, { sizeId: { $exists: false } }],
  }).lean();
  for (const p of products) {
    const sizeId = byLabel.get(p.dimension);
    if (!sizeId) continue;
    await Product.updateOne(
      { _id: p._id, userId },
      { $set: { sizeId, unit: unitById.get(sizeId) || "sqft" } }
    );
  }
}
