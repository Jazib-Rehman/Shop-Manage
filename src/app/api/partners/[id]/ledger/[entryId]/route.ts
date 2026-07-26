import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPartnerLedger } from "@/lib/map";
import { PartnerLedger } from "@/models/PartnerLedger";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const MANUAL = new Set(["investment", "payout", "adjustment"]);

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id, entryId } = await params;
  const doc = await PartnerLedger.findOne({ _id: entryId, userId, partnerId: id });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!MANUAL.has(doc.type)) {
    return NextResponse.json({ error: "Only investment / payout / adjustment can be edited" }, { status: 400 });
  }

  const body = await req.json();
  if (body.type != null) {
    if (!MANUAL.has(body.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    doc.type = body.type;
  }
  if (body.amount != null) {
    const amt = Number(body.amount);
    if (amt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    doc.amount = amt;
  }
  if (body.note != null) doc.note = String(body.note).trim();
  await doc.save();
  return NextResponse.json(mapPartnerLedger(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id, entryId } = await params;
  const doc = await PartnerLedger.findOne({ _id: entryId, userId, partnerId: id });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!MANUAL.has(doc.type)) {
    return NextResponse.json({ error: "Only investment / payout / adjustment can be deleted" }, { status: 400 });
  }
  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
