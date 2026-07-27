import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapExpense } from "@/lib/map";
import { Expense } from "@/models/Expense";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const rows = await Expense.find({ userId }).sort({ spentAt: -1 }).lean();
  return NextResponse.json(rows.map(mapExpense));
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { category, amount, description = "" } = await req.json();
  const amt = Number(amount);
  if (!category?.trim() || !(amt > 0)) {
    return NextResponse.json({ error: "Category and amount required" }, { status: 400 });
  }
  const doc = await Expense.create({
    userId,
    category: String(category).trim(),
    amount: amt,
    description: String(description).trim(),
    spentAt: new Date(),
  });
  return NextResponse.json(mapExpense(doc), { status: 201 });
}
