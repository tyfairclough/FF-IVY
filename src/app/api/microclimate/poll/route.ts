import { NextResponse } from "next/server";
import { BlynkApiError, BlynkConfigError, fetchPrimaryPins } from "@/lib/blynk";
import { ingestPrimaryReading } from "@/lib/env-ingest";
import { timingSafeEqual } from "@/lib/timing-safe";

export const runtime = "nodejs";

function authorizeCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const provided = (match?.[1] ?? "").trim();
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

async function runPoll() {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const deviceName =
    process.env.BLYNK_DEVICE_NAME?.trim() || "Ivy enclosure";
  const recordedAt = new Date();

  let pins;
  try {
    pins = await fetchPrimaryPins();
  } catch (err) {
    if (err instanceof BlynkConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof BlynkApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    throw err;
  }

  const updated: string[] = [];
  const throttled: string[] = [];
  const skipped: string[] = [];

  for (const { pin, valueRaw } of pins) {
    const result = await ingestPrimaryReading({
      pin,
      valueRaw,
      recordedAt,
      deviceName,
      throttle: false,
    });
    if (!result.ok) {
      skipped.push(pin);
      continue;
    }
    if (result.action === "updated") updated.push(pin);
    else throttled.push(pin);
  }

  return NextResponse.json({
    ok: true,
    updated,
    throttled,
    skipped,
    received: pins.map((p) => p.pin),
  });
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPoll();
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runPoll();
}
