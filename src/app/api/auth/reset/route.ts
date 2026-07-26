import { NextResponse } from "next/server";
import { hashPassword, verifyResetToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(req: Request) {
  await db();
  const { token, password } = await req.json().catch(() => ({}));
  const p = String(password ?? "");
  if (p.length < 6) {
    return NextResponse.json({ error: "Password must be 6+ characters" }, { status: 400 });
  }
  const userId = await verifyResetToken(String(token ?? ""));
  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  const user = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  user.passwordHash = hashPassword(p);
  await user.save();
  return NextResponse.json({ ok: true });
}
