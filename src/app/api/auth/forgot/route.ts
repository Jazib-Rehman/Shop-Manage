import { NextResponse } from "next/server";
import { createResetToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { User } from "@/models/User";

export async function POST(req: Request) {
  await db();
  const { email } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  // Always 200 so we don't leak whether the email exists
  const ok = NextResponse.json({
    ok: true,
    message: "If that email is registered, a reset link was sent.",
  });
  if (!e.includes("@")) return ok;

  const user = await User.findOne({ email: e });
  if (!user) return ok;

  const token = await createResetToken(String(user._id));
  const origin = new URL(req.url).origin;
  const link = `${origin}/reset?token=${encodeURIComponent(token)}`;

  try {
    await sendMail(
      e,
      "Reset your Shop Manager password",
      `<p>Click to reset your password (valid 1 hour):</p><p><a href="${link}">${link}</a></p>`
    );
  } catch (err) {
    console.error("forgot-password mail failed", err);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
  return ok;
}
