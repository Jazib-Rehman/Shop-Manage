import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapExpense } from "@/lib/map";
import { Expense } from "@/models/Expense";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Expense.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.category != null) doc.category = String(body.category).trim();
  if (body.amount != null) doc.amount = Number(body.amount);
  if (body.description != null) doc.description = String(body.description).trim();

  if (!doc.category || !(doc.amount > 0)) {
    return NextResponse.json({ error: "Category and amount required" }, { status: 400 });
  }
  await doc.save();
  return NextResponse.json(mapExpense(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  await Expense.deleteOne({ _id: id, userId });
  return NextResponse.json({ ok: true });
}
