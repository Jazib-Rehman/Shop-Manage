import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPartner } from "@/lib/map";
import { Partner } from "@/models/Partner";
import { Product } from "@/models/Product";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Partner.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.name != null) doc.name = String(body.name).trim();
  if (body.phone != null) doc.phone = String(body.phone).trim();
  if (body.incomePercent != null) {
    const pct = Number(body.incomePercent);
    if (!(pct >= 0 && pct <= 100)) {
      return NextResponse.json({ error: "Income % must be 0–100" }, { status: 400 });
    }
    doc.incomePercent = pct;
  }
  if (!doc.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await doc.save();
  return NextResponse.json(mapPartner(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const doc = await Partner.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const used = await Product.exists({ userId, "shares.partnerId": id });
  if (used) {
    return NextResponse.json(
      { error: "Partner still has shared inventory" },
      { status: 400 }
    );
  }
  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
