import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapPartnerLedger } from "@/lib/map";
import { Partner } from "@/models/Partner";
import { PartnerLedger } from "@/models/PartnerLedger";

type Ctx = { params: Promise<{ id: string }> };

/** Hits cash balance (what you can pay out). */
const DEBIT = new Set(["payout", "loss_share"]);
/** Stock capital — tracked separately, never drives balance negative. */
const INVESTMENT = new Set(["purchase_share", "freight_share", "investment", "ownership_share"]);

export async function GET(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const partner = await Partner.findOne({ _id: id, userId }).lean();
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await PartnerLedger.find({ userId, partnerId: id })
    .sort({ createdAt: -1 })
    .lean();
  let credit = 0;
  let debit = 0;
  let invested = 0;
  for (const e of entries) {
    if (INVESTMENT.has(e.type)) {
      invested += e.amount;
      continue;
    }
    if (DEBIT.has(e.type)) debit += e.amount;
    else credit += e.amount;
  }

  return NextResponse.json({
    partner: {
      id: String(partner._id),
      name: partner.name,
      phone: partner.phone ?? "",
      incomePercent: partner.incomePercent ?? 100,
    },
    credit,
    debit,
    balance: credit - debit,
    invested,
    breakdown: {
      sale_share: entries.filter((e) => e.type === "sale_share").reduce((s, e) => s + e.amount, 0),
      purchase_share: entries.filter((e) => e.type === "purchase_share").reduce((s, e) => s + e.amount, 0),
      freight_share: entries.filter((e) => e.type === "freight_share").reduce((s, e) => s + e.amount, 0),
      loss_share: entries.filter((e) => e.type === "loss_share").reduce((s, e) => s + e.amount, 0),
      surplus_share: entries.filter((e) => e.type === "surplus_share").reduce((s, e) => s + e.amount, 0),
      payout: entries.filter((e) => e.type === "payout").reduce((s, e) => s + e.amount, 0),
      adjustment: entries.filter((e) => e.type === "adjustment").reduce((s, e) => s + e.amount, 0),
      investment: entries.filter((e) => e.type === "investment").reduce((s, e) => s + e.amount, 0),
      ownership_share: entries.filter((e) => e.type === "ownership_share").reduce((s, e) => s + e.amount, 0),
    },
    entries: entries.map(mapPartnerLedger),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const partner = await Partner.findOne({ _id: id, userId });
  if (!partner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { type = "payout", amount, note = "" } = await req.json();
  const amt = Number(amount);
  if (amt <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (type !== "payout" && type !== "adjustment") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const defaults: Record<string, string> = {
    payout: "Payout",
    adjustment: "Adjustment",
  };

  const doc = await PartnerLedger.create({
    userId,
    partnerId: id,
    type,
    amount: amt,
    note: String(note).trim() || defaults[type] || type,
  });

  return NextResponse.json(mapPartnerLedger(doc), { status: 201 });
}
