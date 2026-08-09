import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapSize } from "@/lib/map";
import { ensureSizesFromMarbles } from "@/lib/size-migrate";
import { Size } from "@/models/Size";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  await ensureSizesFromMarbles(userId);
  const rows = await Size.find({ userId }).sort({ label: 1 }).lean();
  return NextResponse.json(rows.map(mapSize));
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const body = await req.json();
  const label = String(body.label || "").trim();
  const unit = body.unit === "piece" ? "piece" : "sqft";
  const sqFtPerTon = Number(body.sqFtPerTon) || 0;
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });
  if (sqFtPerTon <= 0) {
    return NextResponse.json(
      { error: unit === "piece" ? "Enter pieces / ton" : "Enter sq ft / ton" },
      { status: 400 }
    );
  }
  try {
    const doc = await Size.create({ userId, label, unit, sqFtPerTon });
    return NextResponse.json(mapSize(doc), { status: 201 });
  } catch (err: unknown) {
    const dup = err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000;
    return NextResponse.json(
      { error: dup ? "Size label already exists" : "Failed to create size" },
      { status: 400 }
    );
  }
}
