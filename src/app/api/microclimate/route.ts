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
  // #region agent log
  const headerNames = [...request.headers.keys()];
  const providedRaw = request.headers.get("x-webhook-secret");
  const providedAlt =
    request.headers.get("X-Webhook-Secret") ??
    request.headers.get("webhook-secret") ??
    null;
  const urlSecret = new URL(request.url).searchParams.get("secret");
  fetch("http://127.0.0.1:7926/ingest/86f94468-743f-4211-ad1e-a630cc67636d", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ca9006",
    },
    body: JSON.stringify({
      sessionId: "ca9006",
      runId: "pre-fix",
      hypothesisId: "A-B-C-E",
      location: "api/microclimate/route.ts:POST",
      message: "webhook auth probe",
      data: {
        hasExpected: Boolean(expected),
        expectedLen: expected?.length ?? 0,
        expectedTrimLen: expected?.trim().length ?? 0,
        providedIsNull: providedRaw === null,
        providedLen: providedRaw?.length ?? 0,
        providedTrimLen: providedRaw?.trim().length ?? 0,
        providedAltLen: providedAlt?.length ?? 0,
        hasUrlSecret: Boolean(urlSecret),
        urlSecretLen: urlSecret?.length ?? 0,
        headerNames,
        headerNamesWithSecret: headerNames.filter((n) =>
          /secret|auth|webhook/i.test(n),
        ),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.log(
    "[ff-ivy-debug]",
    JSON.stringify({
      hypothesisId: "A-B-C-E",
      hasExpected: Boolean(expected),
      expectedLen: expected?.length ?? 0,
      providedIsNull: providedRaw === null,
      providedLen: providedRaw?.length ?? 0,
      hasUrlSecret: Boolean(urlSecret),
      urlSecretLen: urlSecret?.length ?? 0,
      queryKeys: [...new URL(request.url).searchParams.keys()],
      headerNamesWithSecret: headerNames.filter((n) =>
        /secret|auth|webhook/i.test(n),
      ),
    }),
  );
  // #endregion
  if (!expected) {
    return NextResponse.json(
      {
        error: "Webhook secret not configured",
        debugCode: "secret_not_configured",
      },
      { status: 500 },
    );
  }

  // Prefer header; fall back to ?secret= for Microclimate UIs that cannot set headers.
  const provided = (providedRaw || providedAlt || urlSecret || "").trim();
  const expectedTrim = expected.trim();
  const matchedTrim =
    provided.length === expectedTrim.length &&
    timingSafeEqual(provided, expectedTrim);
  // #region agent log
  fetch("http://127.0.0.1:7926/ingest/86f94468-743f-4211-ad1e-a630cc67636d", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ca9006",
    },
    body: JSON.stringify({
      sessionId: "ca9006",
      runId: "post-fix",
      hypothesisId: "A-B",
      location: "api/microclimate/route.ts:authResult",
      message: "webhook auth compare",
      data: {
        matchedTrim,
        lengthEqual: provided.length === expectedTrim.length,
        authSource: providedRaw
          ? "header"
          : providedAlt
            ? "alt-header"
            : urlSecret
              ? "query"
              : "none",
        debugCode: !provided
          ? "missing_secret"
          : matchedTrim
            ? "ok"
            : "secret_mismatch",
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.log(
    "[ff-ivy-debug]",
    JSON.stringify({
      hypothesisId: "A-B",
      matchedTrim,
      authSource: providedRaw
        ? "header"
        : urlSecret
          ? "query"
          : "none",
      debugCode: !provided
        ? "missing_secret"
        : matchedTrim
          ? "ok"
          : "secret_mismatch",
    }),
  );
  // #endregion
  if (!matchedTrim) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        debugCode: !provided ? "missing_secret" : "secret_mismatch",
      },
      { status: 401 },
    );
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
