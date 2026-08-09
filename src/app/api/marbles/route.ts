import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapMarble } from "@/lib/map";
import { syncMarbleProducts, type SizeLike } from "@/lib/marble-sync";
import { Marble } from "@/models/Marble";
import { Size } from "@/models/Size";

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
  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const sizeIds: string[] = Array.isArray(body.sizeIds) ? body.sizeIds.map(String) : [];
  const sizes = await resolveSizes(userId, sizeIds);
  if (sizes instanceof NextResponse) return sizes;
  if (sizes.some((s) => s.sqFtPerTon <= 0)) {
    return NextResponse.json({ error: "Sizes need per-ton weight set on Sizes page" }, { status: 400 });
  }

  const doc = await Marble.create({
    userId,
    name,
    sizeIds: [],
    dimensions: [],
    dimensionWeights: [],
  });
  const synced = await syncMarbleProducts(userId, String(doc._id), name, sizes);
  await Marble.updateOne(
    { _id: doc._id, userId },
    {
      $set: {
        sizeIds: synced.sizeIds,
        dimensions: synced.dimensions,
        dimensionWeights: synced.dimensionWeights,
      },
    }
  );
  const saved = await Marble.findOne({ _id: doc._id, userId }).lean();
  return NextResponse.json(mapMarble(saved), { status: 201 });
}
