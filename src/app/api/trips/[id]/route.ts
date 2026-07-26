import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lineTons } from "@/lib/freight";
import { mapTrip } from "@/lib/map";
import { syncPurchaseLedger } from "@/lib/partner-ledger";
import { recalcProduct } from "@/lib/recalc-product";
import { recomputeTrip } from "@/lib/trip";
import { PartnerLedger } from "@/models/PartnerLedger";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Trip } from "@/models/Trip";

type Ctx = { params: Promise<{ id: string }> };

function rateOf(p?: { sqFtPerTon?: number; tonsPerSqFt?: number }) {
  return Number(p?.sqFtPerTon ?? p?.tonsPerSqFt) || 0;
}

async function tonsFor(userId: string, lines: { productId: unknown; qty: number }[]) {
  if (!lines.length) return 0;
  const products = await Product.find({
    userId,
    _id: { $in: lines.map((l) => l.productId) },
  })
    .select("sqFtPerTon tonsPerSqFt")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), rateOf(p)]));
  return lines.reduce(
    (s, l) => s + lineTons(l.qty, byId.get(String(l.productId)) || 0),
    0
  );
}

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const trip = await Trip.findOne({ _id: id, userId }).lean();
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lines = await Purchase.find({ userId, tripId: id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json(mapTrip(trip, lines, await tonsFor(userId, lines)));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const trip = await Trip.findOne({ _id: id, userId });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (body.note != null) trip.note = String(body.note).trim();
  if (body.truckFare != null) trip.truckFare = Number(body.truckFare) || 0;
  if (body.loadingCost != null) trip.loadingCost = Number(body.loadingCost) || 0;
  if (body.unloadingCost != null) trip.unloadingCost = Number(body.unloadingCost) || 0;
  await trip.save();

  await recomputeTrip(id);

  const lines = await Purchase.find({ userId, tripId: id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json(mapTrip(trip, lines, await tonsFor(userId, lines)));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const trip = await Trip.findOne({ _id: id, userId });
  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = await Purchase.find({ userId, tripId: id });
  const productIds = new Set(lines.map((l) => String(l.productId)));

  for (const line of lines) {
    const existing = await PartnerLedger.find({
      userId,
      purchaseId: String(line._id),
      type: "purchase_share",
    }).lean();
    const shares = existing
      .map((e) => ({
        partnerId: String(e.partnerId),
        percent: line.qty > 0 ? ((e.qty || 0) / line.qty) * 100 : 0,
      }))
      .filter((s) => s.percent > 0);

    line.tripId = null;
    await line.save();

    const product = await Product.findOne({ _id: line.productId, userId }).lean<{
      name: string;
      dimension: string;
    }>();
    await syncPurchaseLedger({
      userId,
      purchaseId: String(line._id),
      productId: String(line.productId),
      qty: line.qty,
      unitCost: line.unitCost,
      shares,
      label: product ? `${product.name} · ${product.dimension}` : "Purchase",
    });
  }

  for (const pid of productIds) await recalcProduct(pid);
  await trip.deleteOne();
  return NextResponse.json({ ok: true });
}
