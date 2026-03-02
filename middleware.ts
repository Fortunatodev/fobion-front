import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import googleRoutes from './path-to-google-routes' // <-- Importe suas rotas do Google aqui

export function middleware(_request: NextRequest) {
  // Sem interceptação — deixa tudo passar para o Next.js
  return NextResponse.next()
}

export const config = {
  matcher: [], // ← VAZIO — não intercepta nenhuma rota
}

// Adicione esta linha para usar as rotas do Google na sua aplicação
app.use("/api/auth", googleRoutes)