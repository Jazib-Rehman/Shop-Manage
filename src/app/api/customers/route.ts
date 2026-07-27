import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapCustomer } from "@/lib/map";
import { Customer } from "@/models/Customer";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const rows = await Customer.find({ userId }).sort({ name: 1 }).lean();
  return NextResponse.json(rows.map(mapCustomer));
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { name, phone } = await req.json();
  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }
  const phoneNorm = String(phone).trim();
  const nameNorm = String(name).trim();
  const existing = await Customer.findOne({ userId, phone: phoneNorm });
  if (existing) {
    return NextResponse.json(
      { error: `Phone already used by “${existing.name}”` },
      { status: 400 }
    );
  }
  const doc = await Customer.create({
    userId,
    name: nameNorm,
    phone: phoneNorm,
  });
  return NextResponse.json(mapCustomer(doc), { status: 201 });
}
