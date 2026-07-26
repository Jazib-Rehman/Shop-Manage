import { NextResponse } from "next/server";
import { defaultAllocations, validateAllocations } from "@/lib/allocations";
import { weightedAvg } from "@/lib/avg";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapSale } from "@/lib/map";
import { syncSaleLedger } from "@/lib/partner-ledger";
import { paymentStatusFrom } from "@/lib/payment";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const body = await req.json();
  const {
    productId,
    qty,
    unitPrice,
    description = "",
    customerId = null,
    dueDate = null,
    amountPaid: amountPaidRaw,
    paymentStatus: mode = "paid",
    allocations: allocationsRaw,
  } = body;
  const q = Number(qty);
  if (!productId || q <= 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const product = await Product.findOne({ _id: productId, userId });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (q > product.stock) {
    return NextResponse.json({ error: "Not enough stock" }, { status: 400 });
  }

  const price = unitPrice != null ? Number(unitPrice) : product.sellPrice;
  const costTotal = q * product.costPrice;
  const total = q * price;

  const mappedProduct = {
    shares: (product.shares ?? []).map((s: { partnerId: unknown; percent: number }) => ({
      partnerId: String(s.partnerId),
      percent: s.percent,
    })),
  };
  const allocations =
    Array.isArray(allocationsRaw) && allocationsRaw.length
      ? allocationsRaw.map((a: { partnerId: string | null; qty: number }) => ({
          partnerId: a.partnerId || null,
          qty: Number(a.qty) || 0,
        }))
      : defaultAllocations(q, mappedProduct);

  const allocErr = validateAllocations(q, allocations);
  if (allocErr) return NextResponse.json({ error: allocErr }, { status: 400 });

  let amountPaid = 0;
  if (mode === "paid") amountPaid = total;
  else if (mode === "partial") amountPaid = Math.min(Math.max(0, Number(amountPaidRaw) || 0), total);

  const paymentStatus = paymentStatusFrom(amountPaid, total);
  const payments =
    amountPaid > 0
      ? [{ amount: amountPaid, note: mode === "paid" ? "Paid in full" : "Initial payment", paidAt: new Date() }]
      : [];

  product.sellPrice = weightedAvg(product.soldQty ?? 0, product.sellPrice, q, price);
  product.soldQty = (product.soldQty ?? 0) + q;
  product.stock -= q;
  await product.save();

  const doc = await Sale.create({
    userId,
    productId,
    qty: q,
    unitPrice: price,
    total,
    costTotal,
    profit: total - costTotal,
    description: String(description).trim(),
    allocations,
    paymentStatus,
    amountPaid,
    payments,
    customerId: customerId || null,
    dueDate: paymentStatus !== "paid" && dueDate ? new Date(dueDate) : null,
    paidAt: paymentStatus === "paid" ? new Date() : null,
  });

  await syncSaleLedger({
    userId,
    saleId: String(doc._id),
    productId: String(product._id),
    unitPrice: price,
    costPrice: product.costPrice,
    allocations,
    label: `${product.name} · ${product.dimension}`,
  });

  return NextResponse.json(mapSale(doc), { status: 201 });
}
