export const GRAPH_PINS = ["v0", "v1", "v2"] as const;
export type GraphPin = (typeof GRAPH_PINS)[number];

export const STATUS_PINS = [
  "v0",
  "v1",
  "v2",
  "v4",
  "v5",
  "v6",
  "v8",
  "v9",
] as const;
export type StatusPin = (typeof STATUS_PINS)[number];

export const PIN_META: Record<
  StatusPin,
  { label: string; unit: string; kind: "primary" | "secondary" }
> = {
  v0: { label: "Yellow Temperature", unit: "°C", kind: "primary" },
  v1: { label: "Red Temperature", unit: "°C", kind: "primary" },
  v2: { label: "Blue Humidity", unit: "%", kind: "primary" },
  v4: { label: "Yellow Output", unit: "%", kind: "secondary" },
  v5: { label: "Red Output", unit: "%", kind: "secondary" },
  v6: { label: "Blue Output", unit: "%", kind: "secondary" },
  v8: { label: "Setpoint 1", unit: "", kind: "secondary" },
  v9: { label: "Setpoint 2", unit: "", kind: "secondary" },
};

export const STALE_AFTER_MS = 15 * 60 * 1000;
export const HISTORY_RETENTION_DAYS = 7;
export const CHART_WINDOW_HOURS = 24;

export function normalizePin(pin: string): string {
  return pin.trim().toLowerCase();
}

export function isGraphPin(pin: string): pin is GraphPin {
  return (GRAPH_PINS as readonly string[]).includes(pin);
}

export function isStatusPin(pin: string): pin is StatusPin {
  return (STATUS_PINS as readonly string[]).includes(pin);
}

/** Parse numeric sensor values; leave messy setpoint strings as null. */
export function parseNumericValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return null;
}

export function formatDisplayValue(
  valueNum: number | null,
  valueRaw: string,
  unit: string,
): string {
  if (valueNum !== null && Number.isFinite(valueNum)) {
    const rounded =
      Math.abs(valueNum) >= 10
        ? valueNum.toFixed(0)
        : valueNum.toFixed(1).replace(/\.0$/, "");
    return unit ? `${rounded}${unit}` : rounded;
  }
  return valueRaw;
}

export function minutesAgoLabel(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Unknown";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  return new Date(iso).toLocaleString("en-GB");
}
