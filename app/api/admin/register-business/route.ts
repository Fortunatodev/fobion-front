import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const SECRET = process.env.ADMIN_DASHBOARD_SECRET;
  if (!SECRET) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  const cookieValue = req.cookies.get("admin-session")?.value;
  if (!verifyAdminSession(cookieValue, SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/auth/register-business`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        "x-admin-token": SECRET,
      },
      body,
    });
  } catch (err) {
    console.error("[admin/register-business] fetch falhou:", err);
    return NextResponse.json({ error: "backend_unreachable" }, { status: 502 });
  }

  const respText = await upstream.text();
  const respContentType =
    upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(respText || null, {
    status: upstream.status,
    headers: { "content-type": respContentType },
  });
}
