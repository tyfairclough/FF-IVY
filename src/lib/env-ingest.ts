import {
  INGEST_THROTTLE_MS,
  PIN_META,
  isGraphPin,
  normalizePin,
  parseNumericValue,
  type PrimaryPin,
} from "@/lib/microclimate";
import { getEnvLatest, upsertEnvReading } from "@/lib/queries";

export type IngestPrimaryInput = {
  pin: string;
  valueRaw: string;
  recordedAt: Date;
  deviceId?: string | null;
  deviceName?: string | null;
  /** When false, always write (used by Blynk poll). Default true for webhook. */
  throttle?: boolean;
};

export type IngestPrimaryResult =
  | { ok: true; pin: PrimaryPin; action: "updated" }
  | { ok: true; pin: PrimaryPin; action: "throttled" }
  | { ok: false; reason: "non_primary_pin" | "empty_value"; pin?: string };

export function isPrimaryPin(pin: string): pin is PrimaryPin {
  return isGraphPin(normalizePin(pin));
}

export async function ingestPrimaryReading(
  input: IngestPrimaryInput,
): Promise<IngestPrimaryResult> {
  const pin = normalizePin(input.pin);
  if (!isPrimaryPin(pin)) {
    return { ok: false, reason: "non_primary_pin", pin };
  }

  const valueRaw = input.valueRaw.trim();
  if (!valueRaw) {
    return { ok: false, reason: "empty_value", pin };
  }

  const throttle = input.throttle !== false;
  if (throttle) {
    const latest = await getEnvLatest();
    const row = latest.find((r) => r.pin === pin);
    if (row) {
      const age = Date.now() - new Date(row.recorded_at).getTime();
      if (Number.isFinite(age) && age >= 0 && age < INGEST_THROTTLE_MS) {
        return { ok: true, pin, action: "throttled" };
      }
    }
  }

  const valueNum = parseNumericValue(valueRaw);
  const meta = PIN_META[pin];

  await upsertEnvReading({
    pin,
    stream_name: meta.label,
    value_raw: valueRaw,
    value_num: valueNum,
    recorded_at: input.recordedAt,
    device_id: input.deviceId ?? null,
    device_name: input.deviceName ?? null,
    writeHistory: valueNum !== null,
  });

  return { ok: true, pin, action: "updated" };
}
