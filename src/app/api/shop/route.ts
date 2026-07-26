import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  mapCustomer,
  mapMarble,
  mapPartner,
  mapProduct,
  mapPurchase,
  mapSale,
} from "@/lib/map";
import { Customer } from "@/models/Customer";
import { Marble } from "@/models/Marble";
import { Partner } from "@/models/Partner";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { Sale } from "@/models/Sale";

export async function GET() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  try {
    await db();
    const [partners, customers, marbles, products, purchases, sales] =
      await Promise.all([
        Partner.find({ userId }).sort({ name: 1 }).lean(),
        Customer.find({ userId }).sort({ name: 1 }).lean(),
        Marble.find({ userId }).sort({ name: 1 }).lean(),
        Product.find({ userId }).sort({ name: 1, dimension: 1 }).lean(),
        Purchase.find({ userId }).sort({ createdAt: -1 }).lean(),
        Sale.find({ userId }).sort({ createdAt: -1 }).lean(),
      ]);
    return NextResponse.json({
      partners: partners.map(mapPartner),
      customers: customers.map(mapCustomer),
      marbles: marbles.map(mapMarble),
      products: products.map(mapProduct),
      purchases: purchases.map(mapPurchase),
      sales: sales.map(mapSale),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
