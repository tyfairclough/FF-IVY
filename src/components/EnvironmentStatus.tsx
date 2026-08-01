"use client";

import { useState } from "react";
import type { EnvLatestRow } from "@/lib/db";
import {
  formatDisplayValue,
  minutesAgoLabel,
  PIN_META,
  STALE_AFTER_MS,
  type StatusPin,
  STATUS_PINS,
} from "@/lib/microclimate";

type Props = {
  readings: EnvLatestRow[];
};

export function EnvironmentStatus({ readings }: Props) {
  const [now] = useState(Date.now);
  const byPin = new Map(readings.map((row) => [row.pin, row]));
  const primary = STATUS_PINS.filter((pin) => PIN_META[pin].kind === "primary");
  const secondary = STATUS_PINS.filter(
    (pin) => PIN_META[pin].kind === "secondary",
  );

  const newestPrimary = primary
    .map((pin) => byPin.get(pin)?.recorded_at)
    .filter(Boolean)
    .map((iso) => new Date(iso!).getTime())
    .sort((a, b) => b - a)[0];

  const stale =
    newestPrimary !== undefined && now - newestPrimary > STALE_AFTER_MS;

  const deviceName =
    readings.find((row) => row.device_name)?.device_name ?? "Microclimate";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Environment</h2>
          <p className="mt-1 text-sm text-slate-300">{deviceName}</p>
        </div>
        {stale ? (
          <p
            className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200"
            role="status"
          >
            Readings look stale (15+ min). Check Wi‑Fi / Blynk webhook.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {primary.map((pin) => (
          <PrimaryCard key={pin} pin={pin} row={byPin.get(pin)} />
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {secondary.map((pin) => (
          <SecondaryChip key={pin} pin={pin} row={byPin.get(pin)} />
        ))}
      </div>
    </section>
  );
}

function PrimaryCard({
  pin,
  row,
}: {
  pin: StatusPin;
  row: EnvLatestRow | undefined;
}) {
  const meta = PIN_META[pin];
  const display = row
    ? formatDisplayValue(row.value_num, row.value_raw, meta.unit)
    : "—";

  return (
    <article className="rounded-3xl border border-emerald-700/40 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">
        {meta.label}
      </p>
      <p className="mt-3 text-4xl font-black text-white">{display}</p>
      <p className="mt-2 text-sm text-slate-400">
        {minutesAgoLabel(row?.recorded_at ?? null)}
      </p>
    </article>
  );
}

function SecondaryChip({
  pin,
  row,
}: {
  pin: StatusPin;
  row: EnvLatestRow | undefined;
}) {
  const meta = PIN_META[pin];
  const display = row
    ? formatDisplayValue(row.value_num, row.value_raw, meta.unit)
    : "—";

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {meta.label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-100">{display}</p>
    </div>
  );
}
