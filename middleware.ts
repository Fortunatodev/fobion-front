import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Web Crypto (compatível com Edge runtime — `node:crypto` não funciona aqui).
async function hmacBase64url(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  // Conversão para base64url
  let bin = "";
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function isAdminCookieValid(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return false;

  const tsStr = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) return false;

  const expected = await hmacBase64url(secret, tsStr);
  return timingSafeStringEqual(expected, sig);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // /admin/login não exige sessão (senão dá loop)
  if (pathname === "/admin/login") return NextResponse.next();

  const SECRET = process.env.ADMIN_DASHBOARD_SECRET;
  if (!SECRET) {
    // Mensagem genérica em produção — não revelar nomes de env vars para atacantes.
    // O log do servidor (não exposto ao público) ainda registra o detalhe.
    console.error("[middleware] ADMIN_DASHBOARD_SECRET ausente — bloqueando /admin");
    return new NextResponse("Acesso negado.", { status: 503 });
  }

  const cookieValue = request.cookies.get("admin-session")?.value;
  const ok = await isAdminCookieValid(cookieValue, SECRET);

  if (!ok) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
