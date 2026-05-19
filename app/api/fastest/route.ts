import { NextResponse } from "next/server";
import { getFastestNow } from "@/lib/fastest";
import { getTfwmCredentials } from "@/lib/gtfs";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!getTfwmCredentials()) {
    return NextResponse.json(
      { error: "Missing TFWM_APP_ID or TFWM_APP_KEY in .env.local" },
      { status: 503 }
    );
  }

  try {
    const pick = await getFastestNow();
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      pick,
    });
  } catch (err) {
    console.error("fastest error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to find fastest bus",
      },
      { status: 500 }
    );
  }
}
