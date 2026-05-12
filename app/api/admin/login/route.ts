import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

// Roda em Node.js runtime para ter node:crypto disponível.
export const runtime = "nodejs";

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias

function signTimestamp(ts: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(String(ts)).digest("base64url");
}

export async function POST(req: NextRequest) {
  const SECRET = process.env.ADMIN_DASHBOARD_SECRET;
  if (!SECRET) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }

  // Timing-safe comparison para evitar ataque por análise de tempo
  const tokenBuf  = Buffer.from(token, "utf-8");
  const secretBuf = Buffer.from(SECRET, "utf-8");
  if (
    tokenBuf.length !== secretBuf.length ||
    !crypto.timingSafeEqual(tokenBuf, secretBuf)
  ) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Cookie value: `${timestamp}.${hmac(timestamp)}` — verificado pelo middleware
  const ts = Date.now();
  const sig = signTimestamp(ts, SECRET);
  const cookieValue = `${ts}.${sig}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin-session", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return res;
}
