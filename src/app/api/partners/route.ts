import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPartner } from "@/lib/map";
import { Partner } from "@/models/Partner";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const rows = await Partner.find({ userId }).sort({ name: 1 }).lean();
  return NextResponse.json(rows.map(mapPartner));
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { name, phone = "", incomePercent = 100 } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const pct = Number(incomePercent);
  if (!(pct >= 0 && pct <= 100)) {
    return NextResponse.json({ error: "Income % must be 0–100" }, { status: 400 });
  }
  const doc = await Partner.create({
    userId,
    name: String(name).trim(),
    phone: String(phone).trim(),
    incomePercent: pct,
  });
  return NextResponse.json(mapPartner(doc), { status: 201 });
}
