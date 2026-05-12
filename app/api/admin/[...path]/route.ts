import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BACKEND_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
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

  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const target = `${BACKEND_URL}/api/admin/${path.join("/")}${search}`;

  const headers: Record<string, string> = {
    "x-admin-token": SECRET,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length > 0 ? body : undefined,
    });
  } catch (err) {
    console.error("[admin-proxy] fetch falhou:", err);
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

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
