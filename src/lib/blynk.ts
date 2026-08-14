import {
  PRIMARY_PINS,
  normalizePin,
  type PrimaryPin,
} from "@/lib/microclimate";

export type BlynkPinValue = {
  pin: PrimaryPin;
  valueRaw: string;
};

export class BlynkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlynkConfigError";
  }
}

export class BlynkApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BlynkApiError";
    this.status = status;
  }
}

function getServerUrl(): string {
  const raw = process.env.BLYNK_SERVER_URL?.trim();
  if (!raw) {
    throw new BlynkConfigError("BLYNK_SERVER_URL is not set");
  }
  return raw.replace(/\/+$/, "");
}

function getDeviceToken(): string {
  const token = process.env.BLYNK_DEVICE_TOKEN?.trim();
  if (!token) {
    throw new BlynkConfigError("BLYNK_DEVICE_TOKEN is not set");
  }
  return token;
}

/** Fetch Yellow temp (v0), Red temp (v1), Blue humidity (v2) from Blynk Device HTTPS API. */
export async function fetchPrimaryPins(): Promise<BlynkPinValue[]> {
  const base = getServerUrl();
  const token = getDeviceToken();
  const pins = PRIMARY_PINS.join("&");
  const url = `${base}/external/api/get?token=${encodeURIComponent(token)}&${pins}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new BlynkApiError(
      `Blynk get failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BlynkApiError(
      `Blynk returned non-JSON: ${text.slice(0, 200)}`,
      502,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BlynkApiError("Blynk response was not a pin map object", 502);
  }

  const map = parsed as Record<string, unknown>;
  const out: BlynkPinValue[] = [];

  for (const pin of PRIMARY_PINS) {
    const key =
      Object.keys(map).find((k) => normalizePin(k) === pin) ?? pin;
    if (!(key in map)) continue;
    const value = map[key];
    if (value === null || value === undefined) continue;
    out.push({ pin, valueRaw: String(value).trim() });
  }

  return out;
}
