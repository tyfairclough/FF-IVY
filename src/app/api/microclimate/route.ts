import { NextResponse } from "next/server";
import {
  isGraphPin,
  isStatusPin,
  normalizePin,
  parseNumericValue,
} from "@/lib/microclimate";
import { upsertEnvReading } from "@/lib/queries";

export const runtime = "nodejs";

type WebhookBody = {
  device_id?: string;
  device_name?: string;
  device_pin?: string;
  device_dataStreamName?: string;
  device_dataStreamAlias?: string;
  device_pinValue?: string | number;
  timestamp_iso8601?: string;
  timestamp_unix?: string | number;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function resolveRecordedAt(body: WebhookBody): Date {
  if (body.timestamp_iso8601) {
    const parsed = new Date(body.timestamp_iso8601);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (body.timestamp_unix !== undefined && body.timestamp_unix !== null) {
    const n = Number(body.timestamp_unix);
    if (Number.isFinite(n)) {
      const ms = n > 1e12 ? n : n * 1000;
      const parsed = new Date(ms);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date();
}

export async function POST(request: Request) {
  const expected = process.env.MICROCLIMATE_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pin = normalizePin(String(body.device_pin ?? ""));
  if (!pin) {
    return NextResponse.json({ error: "Missing device_pin" }, { status: 400 });
  }

  // Ignore noisy non-sensor streams (e.g. Time on v27)
  if (!isStatusPin(pin)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const valueRaw = String(body.device_pinValue ?? "").trim();
  const streamName =
    String(
      body.device_dataStreamName ||
        body.device_dataStreamAlias ||
        pin,
    ).trim() || pin;
  const valueNum = parseNumericValue(valueRaw);
  const recordedAt = resolveRecordedAt(body);

  await upsertEnvReading({
    pin,
    stream_name: streamName,
    value_raw: valueRaw || "—",
    value_num: valueNum,
    recorded_at: recordedAt,
    device_id: body.device_id ? String(body.device_id) : null,
    device_name: body.device_name ? String(body.device_name) : null,
    writeHistory: isGraphPin(pin) && valueNum !== null,
  });

  return NextResponse.json({ ok: true });
}
