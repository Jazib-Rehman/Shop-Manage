import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapProduct } from "@/lib/map";
import { syncOwnershipInvestment } from "@/lib/partner-ledger";
import { Product } from "@/models/Product";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Product.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let sharesChanged = false;
  if (body.shares != null) {
    const shares = (body.shares as { partnerId: string; percent: number }[])
      .map((s) => ({
        partnerId: s.partnerId,
        percent: Number(s.percent) || 0,
      }))
      .filter((s) => s.partnerId && s.percent > 0);
    const sum = shares.reduce((a, s) => a + s.percent, 0);
    if (sum > 100) {
      return NextResponse.json({ error: "Shares cannot exceed 100%" }, { status: 400 });
    }
    doc.set("shares", shares);
    sharesChanged = true;
  }

  await doc.save();
  if (sharesChanged) await syncOwnershipInvestment(userId, id);
  return NextResponse.json(mapProduct(doc));
}
