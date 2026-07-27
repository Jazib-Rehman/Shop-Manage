import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(req: Request) {
  await db();
  const { email, password } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const user = await User.findOne({ email: e });
  if (!user || !verifyPassword(String(password ?? ""), user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const token = await createSession(String(user._id));
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  return NextResponse.json({ ok: true, token });
}
