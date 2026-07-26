import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { StockAdjustment } from "@/models/StockAdjustment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const product = await Product.findOne({ _id: id, userId }).lean();
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [purchases, adjustments] = await Promise.all([
    Purchase.find({ userId, productId: id }).lean(),
    StockAdjustment.find({ userId, productId: id }).lean(),
  ]);

  const entries = [
    ...purchases.map((p) => ({
      id: String(p._id),
      kind: "purchase" as const,
      qty: p.qty,
      unitCost: Number(p.unitCost) || 0,
      tripId: p.tripId ? String(p.tripId) : null,
      note: p.description || "",
      date: (p.createdAt as Date).toISOString(),
    })),
    ...adjustments.map((a) => ({
      id: String(a._id),
      kind: a.type as "loss" | "surplus",
      qty: a.qty,
      note: a.note || "",
      date: (a.createdAt as Date).toISOString(),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({
    product: {
      id: String(product._id),
      name: product.name,
      dimension: product.dimension,
      stock: product.stock,
    },
    entries,
  });
}
