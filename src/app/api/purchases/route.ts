import { NextResponse } from "next/server";
import {
  mergeOwnershipShares,
  validateAllocations,
  type SaleAllocation,
} from "@/lib/allocations";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPurchase } from "@/lib/map";
import { syncPurchaseLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { productId, qty, unitCost, description = "", allocations, shares } = await req.json();
  const q = Number(qty);
  const cost = Number(unitCost);
  if (!productId || q <= 0 || cost < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const product = await Product.findOne({ _id: productId, userId });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let purchaseShares: { partnerId: string; percent: number }[] = [];

  if (allocations != null) {
    const alloc = allocations as SaleAllocation[];
    const err = validateAllocations(q, alloc);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    purchaseShares = alloc
      .filter((a) => a.partnerId && a.qty > 0)
      .map((a) => ({
        partnerId: String(a.partnerId),
        percent: (a.qty / q) * 100,
      }));
    product.set(
      "shares",
      mergeOwnershipShares(
      product.stock,
      product.shares.map((s: { partnerId: unknown; percent: number }) => ({
        partnerId: String(s.partnerId),
        percent: s.percent,
      })),
      q,
      alloc
      )
    );
    await product.save();
  } else if (shares != null) {
    const next = (shares as { partnerId: string; percent: number }[])
      .map((s) => ({ partnerId: s.partnerId, percent: Number(s.percent) || 0 }))
      .filter((s) => s.partnerId && s.percent > 0);
    if (next.reduce((a, s) => a + s.percent, 0) > 100) {
      return NextResponse.json({ error: "Shares cannot exceed 100%" }, { status: 400 });
    }
    product.set("shares", next);
    purchaseShares = next;
    await product.save();
  } else {
    purchaseShares = product.shares.map((s: { partnerId: unknown; percent: number }) => ({
      partnerId: String(s.partnerId),
      percent: s.percent,
    }));
  }

  const doc = await Purchase.create({
    userId,
    productId,
    qty: q,
    unitCost: cost,
    total: q * cost,
    description: String(description).trim(),
  });

  await recalcProduct(productId);

  await syncPurchaseLedger({
    userId,
    purchaseId: String(doc._id),
    productId: String(product._id),
    qty: q,
    unitCost: cost,
    shares: purchaseShares,
    label: `${product.name} · ${product.dimension}`,
  });

  return NextResponse.json(mapPurchase(doc), { status: 201 });
}
