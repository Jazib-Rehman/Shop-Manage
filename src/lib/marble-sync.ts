import { Marble } from "@/models/Marble";
import { Product } from "@/models/Product";

export type SizeLike = {
  id: string;
  label: string;
  unit: "sqft" | "piece";
  sqFtPerTon: number;
};

export function skuFor(name: string, dimension: string) {
  return `${name} · ${dimension}`;
}

/** Keep one stock SKU per marble × size. */
export async function syncMarbleProducts(
  userId: string,
  marbleId: string,
  name: string,
  sizes: SizeLike[]
) {
  const list = sizes.filter((s) => s.label.trim());
  const existing = await Product.find({ marbleId, userId }).lean();

  for (const size of list) {
    const found =
      existing.find((p) => String((p as { sizeId?: unknown }).sizeId || "") === size.id) ||
      existing.find((p) => p.dimension === size.label);
    const payload = {
      name,
      dimension: size.label,
      sizeId: size.id,
      unit: size.unit,
      sqFtPerTon: Math.max(0, Number(size.sqFtPerTon) || 0),
      sku: skuFor(name, size.label),
    };
    if (found) {
      await Product.updateOne({ _id: found._id, userId }, { $set: payload });
    } else {
      await Product.create({
        userId,
        marbleId,
        ...payload,
        stock: 0,
      });
    }
  }

  const keep = new Set(list.map((s) => s.id));
  const keepLabels = new Set(list.map((s) => s.label));
  for (const p of existing) {
    const sid = String((p as { sizeId?: unknown }).sizeId || "");
    const linked = sid ? keep.has(sid) : keepLabels.has(p.dimension);
    if (!linked && p.stock === 0) {
      await Product.deleteOne({ _id: p._id, userId });
    }
  }

  return {
    sizeIds: list.map((s) => s.id),
    dimensions: list.map((s) => s.label),
    dimensionWeights: list.map((s) => ({
      dimension: s.label,
      sqFtPerTon: Math.max(0, Number(s.sqFtPerTon) || 0),
    })),
  };
}

/** Cascade size label into linked products/SKU only — unit/weight stay on Size (display source). */
export async function cascadeSizeChange(userId: string, size: SizeLike) {
  const products = await Product.find({ userId, sizeId: size.id }).lean();
  for (const p of products) {
    await Product.updateOne(
      { _id: p._id, userId },
      { $set: { dimension: size.label, sku: skuFor(p.name, size.label) } }
    );
  }

  const marbles = await Marble.find({ userId, sizeIds: size.id }).lean();
  for (const m of marbles) {
    const marbleProducts = await Product.find({ userId, marbleId: m._id })
      .sort({ dimension: 1 })
      .lean();
    await Marble.updateOne(
      { _id: m._id, userId },
      {
        $set: {
          dimensions: marbleProducts.map((p) => p.dimension),
          dimensionWeights: marbleProducts.map((p) => ({
            dimension: p.dimension,
            sqFtPerTon:
              p.dimension === size.label
                ? Math.max(0, Number(size.sqFtPerTon) || 0)
                : Number(p.sqFtPerTon) || 0,
          })),
        },
      }
    );
  }
}
