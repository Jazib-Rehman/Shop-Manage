import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StockAdjustment } from "@/models/StockAdjustment";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const rows = await StockAdjustment.find({ userId }).lean();
  const map: Record<string, { loss: number; surplus: number }> = {};
  for (const r of rows) {
    const id = String(r.productId);
    if (!map[id]) map[id] = { loss: 0, surplus: 0 };
    if (r.type === "loss") map[id].loss += r.qty;
    else map[id].surplus += r.qty;
  }
  return NextResponse.json(map);
}
