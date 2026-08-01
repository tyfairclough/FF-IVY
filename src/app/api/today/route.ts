import { NextResponse } from "next/server";
import { getTodaySnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getTodaySnapshot();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
