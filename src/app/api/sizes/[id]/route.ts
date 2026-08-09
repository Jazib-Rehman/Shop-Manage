import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapSize } from "@/lib/map";
import { cascadeSizeChange } from "@/lib/marble-sync";
import { Marble } from "@/models/Marble";
import { Product } from "@/models/Product";
import { Size } from "@/models/Size";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const doc = await Size.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (body.label != null) doc.label = String(body.label).trim();
  if (body.unit != null) doc.unit = body.unit === "piece" ? "piece" : "sqft";
  if (body.sqFtPerTon != null || body.unit != null) {
    doc.sqFtPerTon = Number(body.sqFtPerTon ?? doc.sqFtPerTon) || 0;
  }
  if (!doc.label) return NextResponse.json({ error: "Label required" }, { status: 400 });
  if (doc.sqFtPerTon <= 0) {
    return NextResponse.json(
      { error: doc.unit === "piece" ? "Enter pieces / ton" : "Enter sq ft / ton" },
      { status: 400 }
    );
  }

  try {
    await doc.save();
  } catch (err: unknown) {
    const dup = err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000;
    return NextResponse.json(
      { error: dup ? "Size label already exists" : "Failed to update size" },
      { status: 400 }
    );
  }

  const size = {
    id: String(doc._id),
    label: doc.label,
    unit: doc.unit as "sqft" | "piece",
    sqFtPerTon: Number(doc.sqFtPerTon) || 0,
  };
  await cascadeSizeChange(userId, size);

  return NextResponse.json(mapSize(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const doc = await Size.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const usedOnMarble = await Marble.exists({ userId, sizeIds: id });
  const usedOnProduct = await Product.exists({ userId, sizeId: id, stock: { $gt: 0 } });
  if (usedOnMarble || usedOnProduct) {
    return NextResponse.json(
      { error: "Detach this size from marbles (and clear stock) before deleting" },
      { status: 400 }
    );
  }
  await Product.deleteMany({ userId, sizeId: id, stock: 0 });
  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
