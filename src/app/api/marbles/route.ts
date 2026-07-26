import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapMarble } from "@/lib/map";
import { syncMarbleProducts } from "@/lib/marble-sync";
import { Marble } from "@/models/Marble";

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

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const rows = await Marble.find({ userId }).sort({ name: 1 }).lean();
  return NextResponse.json(rows.map(mapMarble));
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { name, dimensions = [], dimensionWeights = [] } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const weights = normalizeWeights(dimensions, dimensionWeights);
  if (weights.some((w) => w.sqFtPerTon <= 0)) {
    return NextResponse.json(
      { error: "Enter sq ft / ton for every dimension" },
      { status: 400 }
    );
  }

  const doc = await Marble.create({
    userId,
    name: name.trim(),
    dimensions: [],
    dimensionWeights: [],
  });
  const dims = await syncMarbleProducts(
    userId,
    String(doc._id),
    doc.name,
    dimensions,
    weights
  );
  await Marble.collection.updateOne(
    { _id: doc._id, userId },
    { $set: { dimensions: dims, dimensionWeights: weights } }
  );
  const saved = await Marble.findOne({ _id: doc._id, userId }).lean();
  return NextResponse.json(mapMarble(saved), { status: 201 });
}
