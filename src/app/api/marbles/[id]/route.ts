import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapMarble } from "@/lib/map";
import { syncMarbleProducts } from "@/lib/marble-sync";
import { recomputeTrip } from "@/lib/trip";
import { Marble } from "@/models/Marble";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";

type Ctx = { params: Promise<{ id: string }> };

function normalizeWeights(
  dimensions: string[],
  dimensionWeights: { dimension?: string; sqFtPerTon?: number; tonsPerSqFt?: number }[]
) {
  return dimensions.map((dimension) => ({
    dimension,
    sqFtPerTon:
      Number(
        dimensionWeights.find((w) => w.dimension === dimension)?.sqFtPerTon ??
          dimensionWeights.find((w) => w.dimension === dimension)?.tonsPerSqFt
      ) || 0,
  }));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Marble.findOne({ _id: id, userId }).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const name =
    body.name != null ? String(body.name).trim() : String(doc.name);
  const dimensions: string[] = body.dimensions ?? doc.dimensions ?? [];
  const sourceWeights = body.dimensionWeights ?? doc.dimensionWeights ?? [];
  const weights = normalizeWeights(dimensions, sourceWeights);
  if (weights.some((w) => w.sqFtPerTon <= 0)) {
    return NextResponse.json(
      { error: "Enter sq ft / ton for every dimension" },
      { status: 400 }
    );
  }

  const dims = await syncMarbleProducts(userId, id, name, dimensions, weights);
  await Marble.collection.updateOne(
    { _id: doc._id, userId },
    { $set: { name, dimensions: dims, dimensionWeights: weights } }
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
