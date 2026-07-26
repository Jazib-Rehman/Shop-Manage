import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lineTons } from "@/lib/freight";
import { mapTrip } from "@/lib/map";
import { recomputeTrip } from "@/lib/trip";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Trip } from "@/models/Trip";

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

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).lean();
  const tripIds = trips.map((t) => t._id);
  const lines = tripIds.length
    ? await Purchase.find({ userId, tripId: { $in: tripIds } }).sort({ createdAt: 1 }).lean()
    : [];
  const byTrip = new Map<string, (typeof lines)[number][]>();
  for (const l of lines) {
    const k = String(l.tripId);
    if (!byTrip.has(k)) byTrip.set(k, []);
    byTrip.get(k)!.push(l);
  }
  const productIds = [...new Set(lines.map((l) => String(l.productId)))];
  const products = productIds.length
    ? await Product.find({ userId, _id: { $in: productIds } })
        .select("sqFtPerTon tonsPerSqFt")
        .lean()
    : [];
  const rateById = new Map(products.map((p) => [String(p._id), rateOf(p)]));
  return NextResponse.json(
    trips.map((t) => {
      const ls = byTrip.get(String(t._id)) ?? [];
      const tons = ls.reduce(
        (s, l) => s + lineTons(l.qty, rateById.get(String(l.productId)) || 0),
        0
      );
      return mapTrip(t, ls, tons);
    })
  );
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const body = await req.json();
  const note = String(body.note ?? "").trim();
  const truckFare = Number(body.truckFare) || 0;
  const loadingCost = Number(body.loadingCost) || 0;
  const unloadingCost = Number(body.unloadingCost) || 0;
  const purchaseIds = (Array.isArray(body.purchaseIds) ? body.purchaseIds : [])
    .map((id: unknown) => String(id || ""))
    .filter(Boolean);

  if (!purchaseIds.length) {
    return NextResponse.json({ error: "Add at least one purchase" }, { status: 400 });
  }

  const purchases = await Purchase.find({ userId, _id: { $in: purchaseIds } });
  if (purchases.length !== purchaseIds.length) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }
  if (purchases.some((p) => p.tripId != null)) {
    return NextResponse.json(
      { error: "A selected purchase is already on a trip" },
      { status: 400 }
    );
  }
  const products = await Product.find({
    userId,
    _id: { $in: purchases.map((p) => p.productId) },
  })
    .select("sqFtPerTon tonsPerSqFt")
    .lean();
  if (
    products.some(
      (p) =>
        !(
          Number(
            (p as { sqFtPerTon?: number; tonsPerSqFt?: number }).sqFtPerTon ??
              (p as { tonsPerSqFt?: number }).tonsPerSqFt
          ) > 0
        )
    )
  ) {
    return NextResponse.json(
      { error: "Set sq ft / ton for every selected product in Catalog" },
      { status: 400 }
    );
  }

  const trip = await Trip.create({ userId, note, truckFare, loadingCost, unloadingCost });
  await Purchase.updateMany(
    { userId, _id: { $in: purchaseIds } },
    { $set: { tripId: trip._id } }
  );
  await recomputeTrip(String(trip._id));

  const lineDocs = await Purchase.find({ userId, tripId: trip._id }).sort({ createdAt: 1 }).lean();
  return NextResponse.json(mapTrip(trip, lineDocs, await tonsFor(userId, lineDocs)), {
    status: 201,
  });
}
