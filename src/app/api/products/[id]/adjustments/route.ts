import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/map";
import { syncAdjustmentLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { Product } from "@/models/Product";
import { StockAdjustment } from "@/models/StockAdjustment";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const { type, qty, note = "" } = await req.json();
  const q = Number(qty);

  if (type !== "loss" && type !== "surplus") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!(q > 0)) {
    return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
  }

  const product = await Product.findOne({ _id: id, userId });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (type === "loss" && product.stock - q < -1e-9) {
    return NextResponse.json({ error: "Not enough stock" }, { status: 400 });
  }

  const adj = await StockAdjustment.create({
    userId,
    productId: id,
    type,
    qty: q,
    note: String(note).trim(),
  });

  const r = await recalcProduct(id);
  if (r?.error) {
    await adj.deleteOne();
    return NextResponse.json({ error: r.error }, { status: 400 });
  }

  const refreshed = await Product.findOne({ _id: id, userId }).lean();
  await syncAdjustmentLedger({
    userId,
    adjustmentId: String(adj._id),
    productId: id,
    type,
    qty: q,
    unitCost: Number(refreshed?.costPrice) || Number(product.costPrice) || 0,
    label: `${product.name} · ${product.dimension}`,
  });

  return NextResponse.json(
    {
      adjustment: {
        id: String(adj._id),
        kind: type,
        qty: q,
        note: adj.note,
        date: (adj.createdAt as Date).toISOString(),
      },
      product: mapProduct(r!.product),
    },
    { status: 201 }
  );
}
