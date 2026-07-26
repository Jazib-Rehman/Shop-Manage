import { Product } from "@/models/Product";

export function skuFor(name: string, dimension: string) {
  return `${name} · ${dimension}`;
}

/** Keep one stock SKU per marble × dimension. */
export async function syncMarbleProducts(
  userId: string,
  marbleId: string,
  name: string,
  dimensions: string[],
  dimensionWeights: { dimension: string; sqFtPerTon: number }[] = []
) {
  const dims = [...new Set(dimensions.map((d) => d.trim()).filter(Boolean))];
  const weightOf = (dimension: string) =>
    Math.max(
      0,
      Number(dimensionWeights.find((w) => w.dimension === dimension)?.sqFtPerTon) || 0
    );
  const existing = await Product.find({ marbleId, userId }).lean();

  for (const dimension of dims) {
    const found = existing.find((p) => p.dimension === dimension);
    const sqFtPerTon = weightOf(dimension);
    if (found) {
      await Product.collection.updateOne(
        { _id: found._id, userId },
        { $set: { name, sqFtPerTon, sku: skuFor(name, dimension) } }
      );
    } else {
      await Product.create({
        userId,
        marbleId,
        name,
        dimension,
        sqFtPerTon,
        sku: skuFor(name, dimension),
        stock: 0,
      });
    }
  }

  const keep = new Set(dims);
  for (const p of existing) {
    if (!keep.has(p.dimension) && p.stock === 0) {
      await Product.deleteOne({ _id: p._id, userId });
    }
  }

  return dims;
}
