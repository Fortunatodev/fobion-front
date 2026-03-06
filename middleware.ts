import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Proteção /admin — exige cookie "admin-token" válido ──────────────────
  if (pathname.startsWith("/admin")) {
    const expectedToken = process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_TOKEN;

    // Se o token não está configurado no ambiente, bloqueia tudo
    if (!expectedToken) {
      return new NextResponse("Acesso negado", { status: 403 });
    }

    // Verificar cookie de autenticação admin
    const cookieToken = request.cookies.get("admin-token")?.value;

    // Se não tem cookie ou cookie inválido → redirecionar para /admin/login
    if (!cookieToken || cookieToken !== expectedToken) {
      // Se já está na página de login, deixa passar (para não dar loop)
      if (pathname === "/admin/login") {
        return NextResponse.next();
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};