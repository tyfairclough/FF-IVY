import { NextRequest, NextResponse } from "next/server";
import { getCalendarSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const now = new Date();
  const yearParam = Number(request.nextUrl.searchParams.get("year"));
  const monthParam = Number(request.nextUrl.searchParams.get("month"));
  const year = Number.isFinite(yearParam) && yearParam > 0
    ? yearParam
    : now.getFullYear();
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getMonth() + 1;

  const data = await getCalendarSnapshot(year, month);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
