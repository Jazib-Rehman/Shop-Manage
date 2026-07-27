import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

function withCors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin") || "*";
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && req.method === "OPTIONS") {
    return withCors(req, new NextResponse(null, { status: 204 }));
  }

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot" ||
    pathname === "/reset";
  const isAuthApi = pathname.startsWith("/api/auth/");

  if (isAuthApi) return withCors(req, NextResponse.next());

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await verifySession(bearer || req.cookies.get(SESSION_COOKIE)?.value);

  if (isAuthPage) {
    return user
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next();
  }
  if (!user) {
    if (isApi) {
      return withCors(req, NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return isApi ? withCors(req, NextResponse.next()) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
