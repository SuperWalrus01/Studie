import { NextRequest, NextResponse } from "next/server";

/**
 * The Alexa Lambda is the only intended caller of `/api/alexa/*`.
 * Set ALEXA_PROXY_KEY in both places to keep the endpoints from being
 * a free, unauthenticated read of the TfWM quota. Unset = open (dev only).
 */
export function checkProxyKey(req: NextRequest): NextResponse | null {
  const expected = process.env.ALEXA_PROXY_KEY?.trim();
  if (!expected) return null;

  const provided = req.headers.get("x-alexa-proxy-key")?.trim();
  if (provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
