import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mapCustomer,
  mapExpense,
  mapMarble,
  mapPartner,
  mapProduct,
  mapPurchase,
  mapSale,
  mapSize,
} from "@/lib/map";
import { Customer } from "@/models/Customer";
import { Expense } from "@/models/Expense";
import { Marble } from "@/models/Marble";
import { Partner } from "@/models/Partner";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";
import { Size } from "@/models/Size";
import { ensureSizesFromMarbles } from "@/lib/size-migrate";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  try {
    await db();
    await ensureSizesFromMarbles(userId);
    const [partners, customers, sizes, marbles, products, purchases, sales, expenses] =
      await Promise.all([
        Partner.find({ userId }).sort({ name: 1 }).lean(),
        Customer.find({ userId }).sort({ name: 1 }).lean(),
        Size.find({ userId }).sort({ label: 1 }).lean(),
        Marble.find({ userId }).sort({ name: 1 }).lean(),
        Product.find({ userId }).sort({ name: 1, dimension: 1 }).lean(),
        Purchase.find({ userId }).sort({ createdAt: -1 }).lean(),
        Sale.find({ userId }).sort({ createdAt: -1 }).lean(),
        Expense.find({ userId }).sort({ spentAt: -1 }).lean(),
      ]);
    const sizeList = sizes.map(mapSize);
    const sizeById = new Map(sizeList.map((s) => [s.id, s]));
    return NextResponse.json({
      partners: partners.map(mapPartner),
      customers: customers.map(mapCustomer),
      sizes: sizeList,
      marbles: marbles.map(mapMarble),
      products: products.map((p) => {
        const mapped = mapProduct(p);
        const size = mapped.sizeId ? sizeById.get(mapped.sizeId) : undefined;
        if (!size) return mapped;
        return {
          ...mapped,
          unit: size.unit,
          sqFtPerTon: size.sqFtPerTon,
          dimension: size.label,
        };
      }),
      purchases: purchases.map(mapPurchase),
      sales: sales.map(mapSale),
      expenses: expenses.map(mapExpense),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
