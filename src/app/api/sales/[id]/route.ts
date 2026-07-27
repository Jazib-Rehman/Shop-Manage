import { NextResponse } from "next/server";
import { defaultAllocations, validateAllocations } from "@/lib/allocations";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapSale } from "@/lib/map";
import { clearSaleLedger, syncSaleLedger } from "@/lib/partner-ledger";
import { paymentStatusFrom } from "@/lib/payment";
import { recalcProduct } from "@/lib/recalc-product";
import { Product } from "@/models/Product";
import { Sale } from "@/models/Sale";

type Ctx = { params: Promise<{ id: string }> };

function applyPaymentTotals(doc: InstanceType<typeof Sale>) {
  const payments = doc.payments ?? [];
  doc.amountPaid = payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);
  doc.paymentStatus = paymentStatusFrom(doc.amountPaid, doc.total);
  if (doc.paymentStatus === "paid") {
    doc.amountPaid = doc.total;
    doc.paidAt = doc.paidAt ?? new Date();
    doc.dueDate = null;
  } else {
    doc.paidAt = null;
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const body = await req.json();
  const doc = await Sale.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.addPayment != null) {
    const amount = Number(body.addPayment);
    const due = Math.max(0, doc.total - (doc.amountPaid || 0));
    if (amount <= 0 || amount > due + 1e-9) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }
    doc.payments.push({
      amount,
      note: String(body.note ?? "").trim(),
      paidAt: new Date(),
    });
    applyPaymentTotals(doc);
    await doc.save();
    return NextResponse.json(mapSale(doc));
  }

  if (body.updatePayment != null) {
    const { id: paymentId, amount, note } = body.updatePayment as {
      id: string;
      amount?: number;
      note?: string;
    };
    const pay = doc.payments.id(paymentId);
    if (!pay) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    const others = (doc.payments ?? [])
      .filter((p: { _id?: { toString(): string } }) => String(p._id) !== String(paymentId))
      .reduce((s: number, p: { amount: number }) => s + p.amount, 0);
    const nextAmt = amount != null ? Number(amount) : pay.amount;
    if (!(nextAmt > 0) || others + nextAmt > doc.total + 1e-9) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }
    pay.amount = nextAmt;
    if (note != null) pay.note = String(note).trim();
    applyPaymentTotals(doc);
    await doc.save();
    return NextResponse.json(mapSale(doc));
  }

  if (body.deletePayment != null) {
    const paymentId = String(body.deletePayment);
    const pay = doc.payments.id(paymentId);
    if (!pay) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    pay.deleteOne();
    applyPaymentTotals(doc);
    await doc.save();
    return NextResponse.json(mapSale(doc));
  }

  if (body.markPaid === true) {
    const due = Math.max(0, doc.total - (doc.amountPaid || 0));
    if (due > 0) {
      doc.payments.push({ amount: due, note: "Settled in full", paidAt: new Date() });
    }
    applyPaymentTotals(doc);
    await doc.save();
    return NextResponse.json(mapSale(doc));
  }

  const prevProductId = String(doc.productId);
  const snapshot = doc.toObject();

  if (body.productId != null) doc.productId = body.productId;
  if (body.qty != null) doc.qty = Number(body.qty);
  if (body.unitPrice != null) doc.unitPrice = Number(body.unitPrice);
  if (body.description != null) doc.description = String(body.description).trim();
  if (body.customerId !== undefined) doc.customerId = body.customerId || null;
  if (body.dueDate !== undefined) {
    doc.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body.allocations != null) {
    doc.allocations = body.allocations.map((a: { partnerId: string | null; qty: number }) => ({
      partnerId: a.partnerId || null,
      qty: Number(a.qty) || 0,
    }));
  }
  if (doc.qty <= 0 || doc.unitPrice < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  doc.total = doc.qty * doc.unitPrice;
  applyPaymentTotals(doc);
  await doc.save();

  const ids = [...new Set([prevProductId, String(doc.productId)])];
  for (const pid of ids) {
    const r = await recalcProduct(pid);
    if (r?.error) {
      await Sale.findOneAndUpdate({ _id: id, userId }, snapshot);
      await recalcProduct(prevProductId);
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
  }

  const product = await Product.findOne({ _id: doc.productId, userId });
  if (product) {
    doc.costTotal = doc.qty * product.costPrice;
    doc.profit = doc.total - doc.costTotal;
    if (!doc.allocations?.length) {
      doc.set(
        "allocations",
        defaultAllocations(doc.qty, {
          shares: (product.shares ?? []).map((s: { partnerId: unknown; percent: number }) => ({
            partnerId: String(s.partnerId),
            percent: s.percent,
          })),
        })
      );
    }
    const allocErr = validateAllocations(
      doc.qty,
      doc.allocations.map((a: { partnerId?: unknown; qty: number }) => ({
        partnerId: a.partnerId ? String(a.partnerId) : null,
        qty: a.qty,
      }))
    );
    if (allocErr) {
      await Sale.findOneAndUpdate({ _id: id, userId }, snapshot);
      return NextResponse.json({ error: allocErr }, { status: 400 });
    }
    await doc.save();
    await syncSaleLedger({
      userId,
      saleId: id,
      productId: String(product._id),
      unitPrice: doc.unitPrice,
      costPrice: product.costPrice,
      allocations: doc.allocations.map((a: { partnerId?: unknown; qty: number }) => ({
        partnerId: a.partnerId ? String(a.partnerId) : null,
        qty: a.qty,
      })),
      label: `${product.name} · ${product.dimension}`,
    });
  }

  return NextResponse.json(mapSale(doc));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const { id } = await params;
  const doc = await Sale.findOne({ _id: id, userId });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const productId = String(doc.productId);
  await clearSaleLedger(id, userId);
  await doc.deleteOne();
  await recalcProduct(productId);
  return NextResponse.json({ ok: true });
}
