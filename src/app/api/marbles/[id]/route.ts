import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapMarble } from "@/lib/map";
import { syncMarbleProducts, type SizeLike } from "@/lib/marble-sync";
import { recomputeTrip } from "@/lib/trip";
import { Marble } from "@/models/Marble";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Size } from "@/models/Size";

type Ctx = { params: Promise<{ id: string }> };

async function resolveSizes(userId: string, sizeIds: string[]): Promise<SizeLike[] | NextResponse> {
  const ids = [...new Set(sizeIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  const rows = await Size.find({ userId, _id: { $in: ids } }).lean();
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: "One or more sizes not found" }, { status: 400 });
  }
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return ids.map((id) => {
    const r = byId.get(id)!;
    return {
      id,
      label: r.label,
      unit: (r.unit === "piece" ? "piece" : "sqft") as "sqft" | "piece",
      sqFtPerTon: Number(r.sqFtPerTon) || 0,
    };
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Marble.findOne({ _id: id, userId }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name = body.name != null ? String(body.name).trim() : String(doc.name);
  const sizeIds: string[] = Array.isArray(body.sizeIds)
    ? body.sizeIds.map(String)
    : (doc.sizeIds ?? []).map(String);

  const sizes = await resolveSizes(userId, sizeIds);
  if (sizes instanceof NextResponse) return sizes;
  if (sizes.some((s) => s.sqFtPerTon <= 0)) {
    return NextResponse.json({ error: "Sizes need per-ton weight set on Sizes page" }, { status: 400 });
  }

  const synced = await syncMarbleProducts(userId, id, name, sizes);
  await Marble.updateOne(
    { _id: doc._id, userId },
    {
      $set: {
        name,
        sizeIds: synced.sizeIds,
        dimensions: synced.dimensions,
        dimensionWeights: synced.dimensionWeights,
      },
    }
  );

  const productIds = await Product.find({ userId, marbleId: id }).distinct("_id");
  const tripIds = await Purchase.find({
    userId,
    productId: { $in: productIds },
    tripId: { $ne: null },
  }).distinct("tripId");
  for (const tripId of tripIds) await recomputeTrip(String(tripId));

  const saved = await Marble.findOne({ _id: id, userId }).lean();
  return NextResponse.json(mapMarble(saved));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const marble = await Marble.findOne({ _id: id, userId });
  if (!marble) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inStock = await Product.exists({ userId, marbleId: id, stock: { $gt: 0 } });
  if (inStock) {
    return NextResponse.json(
      { error: "Clear stock before deleting this marble" },
      { status: 400 }
    );
  }
  await Product.deleteMany({ userId, marbleId: id });
  await marble.deleteOne();
  return NextResponse.json({ ok: true });
}
