import { NextResponse } from "next/server";

// GET /api/status — endpoint público de health/smoke test.
// Retorna { status, commit } pra confirmar build/deploy ativo.
// Origem: fluxo Hermes multi-agente, Jira FOR-7.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    commit: process.env.NEXT_PUBLIC_GIT_SHA ?? "dev",
  });
}
