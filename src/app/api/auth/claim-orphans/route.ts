import { NextResponse } from "next/server";
import { isAuthed, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import mongoose from "mongoose";

/** One-shot: attach orphan shop docs (no userId) to the current account. */
export async function POST() {
  const userId = await requireUser();
  if (!isAuthed(userId)) return userId;
  await db();
  const filter = { $or: [{ userId: { $exists: false } }, { userId: null }] };
  const oid = new mongoose.Types.ObjectId(userId);
  const cols = await mongoose.connection.db!.listCollections().toArray();
  const result: Record<string, number> = {};
  for (const { name } of cols) {
    if (name === "users" || name.startsWith("system.")) continue;
    const res = await mongoose.connection.collection(name).updateMany(filter, {
      $set: { userId: oid },
    });
    if (res.matchedCount) result[name] = res.modifiedCount;
  }
  return NextResponse.json({ ok: true, result });
}
