import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPurchase } from "@/lib/map";
import { clearPurchaseLedger, syncPurchaseLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Purchase.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prevProductId = String(doc.productId);
  const snapshot = doc.toObject();

  if (body.productId != null) doc.productId = body.productId;
  if (body.qty != null) doc.qty = Number(body.qty);
  if (body.unitCost != null) doc.unitCost = Number(body.unitCost);
  if (body.description != null) doc.description = String(body.description).trim();
  doc.total = doc.qty * doc.unitCost;
  if (doc.qty <= 0 || doc.unitCost < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await doc.save();

  const ids = [...new Set([prevProductId, String(doc.productId)])];
  for (const pid of ids) {
    const r = await recalcProduct(pid);
    if (r?.error) {
      await Purchase.findOneAndUpdate({ _id: id, userId }, {
        productId: snapshot.productId,
        qty: snapshot.qty,
        unitCost: snapshot.unitCost,
        total: snapshot.total,
        description: snapshot.description,
        tripId: snapshot.tripId,
      });
      await recalcProduct(prevProductId);
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
  }

  const product = await Product.findOne({ _id: doc.productId, userId });
  if (product) {
    await syncPurchaseLedger({
      userId,
      purchaseId: String(doc._id),
      productId: String(product._id),
      qty: doc.qty,
      unitCost: doc.unitCost,
      shares: product.shares.map((s: { partnerId: unknown; percent: number }) => ({
        partnerId: String(s.partnerId),
        percent: s.percent,
      })),
      label: `${product.name} · ${product.dimension}`,
    });
  }

  return NextResponse.json(mapPurchase(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const doc = await Purchase.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const productId = String(doc.productId);
  await clearPurchaseLedger(id, userId);
  await doc.deleteOne();
  const r = await recalcProduct(productId);
  if (r?.error) {
    return NextResponse.json({ error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
