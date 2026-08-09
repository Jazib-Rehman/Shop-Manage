import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/map";
import { clearAdjustmentLedger, syncAdjustmentLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { Product } from "@/models/Product";
import { StockAdjustment } from "@/models/StockAdjustment";

type Ctx = { params: Promise<{ id: string; adjId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id, adjId } = await params;
  const product = await Product.findOne({ _id: id, userId });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const adj = await StockAdjustment.findOne({ _id: adjId, userId, productId: id });
  if (!adj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = { type: adj.type, qty: adj.qty, note: adj.note };
  if (body.type === "loss" || body.type === "surplus") adj.type = body.type;
  if (body.qty != null) adj.qty = Number(body.qty);
  if (body.note != null) adj.note = String(body.note).trim();
  if (!(adj.qty > 0)) {
    return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
  }
  await adj.save();

  const r = await recalcProduct(id);
  if (r?.error) {
    adj.type = snap.type;
    adj.qty = snap.qty;
    adj.note = snap.note;
    await adj.save();
    await recalcProduct(id);
    return NextResponse.json({ error: r.error }, { status: 400 });
  }

  const refreshed = await Product.findOne({ _id: id, userId }).lean();
  await syncAdjustmentLedger({
    userId,
    adjustmentId: String(adj._id),
    productId: id,
    type: adj.type as "loss" | "surplus",
    qty: adj.qty,
    unitCost: Number(refreshed?.costPrice) || Number(product.costPrice) || 0,
    label: `${product.name} · ${product.dimension}`,
  });

  return NextResponse.json({
    adjustment: {
      id: String(adj._id),
      kind: adj.type,
      qty: adj.qty,
      note: adj.note,
      date: (adj.createdAt as Date).toISOString(),
    },
    product: mapProduct(r!.product),
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id, adjId } = await params;
  const product = await Product.findOne({ _id: id, userId });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const adj = await StockAdjustment.findOne({ _id: adjId, userId, productId: id });
  if (!adj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = adj.toObject();
  await adj.deleteOne();
  await clearAdjustmentLedger(adjId, userId);
  const r = await recalcProduct(id);
  if (r?.error) {
    await StockAdjustment.create(snap);
    await recalcProduct(id);
    return NextResponse.json({ error: r.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, product: mapProduct(r!.product) });
}
