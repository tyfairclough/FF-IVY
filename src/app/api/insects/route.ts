import { NextResponse } from "next/server";
import { getInsectsSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getInsectsSnapshot();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
