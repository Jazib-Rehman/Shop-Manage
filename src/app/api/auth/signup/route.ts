import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(req: Request) {
  await db();
  const { email, password } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const p = String(password ?? "");
  if (!e || !e.includes("@") || p.length < 6) {
    return NextResponse.json(
      { error: "Valid email and password (6+ chars) required" },
      { status: 400 }
    );
  }
  const exists = await User.findOne({ email: e }).lean();
  if (exists) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const user = await User.create({ email: e, passwordHash: hashPassword(p) });
  const token = await createSession(String(user._id));
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  return NextResponse.json({ ok: true, token }, { status: 201 });
}
