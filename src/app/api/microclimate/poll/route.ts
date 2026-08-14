import { NextResponse } from "next/server";
import { BlynkApiError, BlynkConfigError, fetchPrimaryPins } from "@/lib/blynk";
import { ingestPrimaryReading } from "@/lib/env-ingest";

export const runtime = "nodejs";

async function runPoll() {
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

export async function GET() {
  return runPoll();
}

export async function POST() {
  return runPoll();
}
