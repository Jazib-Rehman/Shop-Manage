import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapCustomer } from "@/lib/map";
import { Customer } from "@/models/Customer";
import { Sale } from "@/models/Sale";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Customer.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.name != null) doc.name = String(body.name).trim();
  if (body.phone != null) {
    const phone = String(body.phone).trim();
    const taken = await Customer.findOne({ userId, phone, _id: { $ne: id } });
    if (taken) {
      return NextResponse.json({ error: "Phone already used" }, { status: 400 });
    }
    doc.phone = phone;
  }
  if (!doc.name || !doc.phone) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }
  await doc.save();
  return NextResponse.json(mapCustomer(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const used = await Sale.exists({ userId, customerId: id });
  if (used) {
    return NextResponse.json(
      { error: "Customer has sales — cannot delete" },
      { status: 400 }
    );
  }
  await Customer.deleteOne({ _id: id, userId });
  return NextResponse.json({ ok: true });
}
