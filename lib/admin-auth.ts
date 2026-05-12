import crypto from "node:crypto";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function verifyAdminSession(
  cookieValue: string | undefined,
  secret: string,
): boolean {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return false;

  const tsStr = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(tsStr)
    .digest("base64url");

  const expectedBuf = Buffer.from(expected, "utf-8");
  const sigBuf = Buffer.from(sig, "utf-8");
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}
