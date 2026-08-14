import { NextResponse } from "next/server";
import { ingestPrimaryReading, isPrimaryPin } from "@/lib/env-ingest";
import { normalizePin } from "@/lib/microclimate";
import { timingSafeEqual } from "@/lib/timing-safe";

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
  webhook_secret?: string;
  secret?: string;
};

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

function extractBasicAuthPassword(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Basic\s+(.+)$/i.exec(auth.trim());
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    const colon = decoded.indexOf(":");
    if (colon < 0) return decoded;
    return decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const expected = process.env.MICROCLIMATE_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        error: "Webhook secret not configured",
        debugCode: "secret_not_configured",
      },
      { status: 500 },
    );
  }

  const rawText = await request.text();
  let body: WebhookBody;
  try {
    if (!rawText.trim()) {
      throw new Error("empty_body");
    }
    body = JSON.parse(rawText) as WebhookBody;
  } catch {
    // Return 200 so Blynk/Microclimate does not count this toward webhook disable.
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "invalid_json",
      rawLen: rawText.length,
    });
  }

  const providedRaw = request.headers.get("x-webhook-secret");
  const providedAlt =
    request.headers.get("X-Webhook-Secret") ??
    request.headers.get("webhook-secret") ??
    null;
  const urlSecret = new URL(request.url).searchParams.get("secret");
  const basicPassword = extractBasicAuthPassword(request);
  const bodySecret =
    typeof body.webhook_secret === "string"
      ? body.webhook_secret
      : typeof body.secret === "string"
        ? body.secret
        : null;

  const authSource = providedRaw
    ? "header"
    : providedAlt
      ? "alt-header"
      : basicPassword
        ? "basic"
        : urlSecret
          ? "query"
          : bodySecret
            ? "body"
            : "none";
  const provided = (
    providedRaw ||
    providedAlt ||
    basicPassword ||
    urlSecret ||
    bodySecret ||
    ""
  ).trim();
  const expectedTrim = expected.trim();
  const matchedTrim =
    provided.length === expectedTrim.length &&
    timingSafeEqual(provided, expectedTrim);

  if (!matchedTrim) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        debugCode: !provided ? "missing_secret" : "secret_mismatch",
        hint: !provided
          ? 'Put "webhook_secret":"YOUR_SECRET" as a plain string inside the Custom JSON body, or use ?secret= on the URL.'
          : "Secret was sent but did not match. Check the secret value.",
      },
      { status: 401 },
    );
  }

  const pin = normalizePin(String(body.device_pin ?? ""));
  if (!pin) {
    return NextResponse.json({ error: "Missing device_pin" }, { status: 400 });
  }

  if (!isPrimaryPin(pin)) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "non_primary_pin",
    });
  }

  const valueRaw = String(body.device_pinValue ?? "").trim();
  const result = await ingestPrimaryReading({
    pin,
    valueRaw: valueRaw || "—",
    recordedAt: resolveRecordedAt(body),
    deviceId: body.device_id ? String(body.device_id) : null,
    deviceName: body.device_name ? String(body.device_name) : null,
    throttle: true,
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: result.reason,
      authSource,
    });
  }

  return NextResponse.json({
    ok: true,
    authSource,
    pin: result.pin,
    action: result.action,
  });
}
