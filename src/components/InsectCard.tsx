"use client";

import { useTransition } from "react";
import { logInsectAction, setInsectStockAction } from "@/lib/actions";
import type { InsectRow } from "@/lib/db";
import { useToast } from "@/components/ToastProvider";
import {
  daysSince,
  daysSinceLabel,
  statusClasses,
  statusTone,
} from "@/lib/status";

export function InsectCard({ insect }: { insect: InsectRow }) {
  const { pushToast } = useToast();
  const [pending, startTransition] = useTransition();

  function toggleStock() {
    startTransition(async () => {
      try {
        const result = await setInsectStockAction(insect.key, !insect.in_stock);
        pushToast(result.message);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Could not update stock");
      }
    });
  }

  function log(kind: "gut_load" | "clean") {
    startTransition(async () => {
      try {
        const result = await logInsectAction(insect.key, kind);
        pushToast(result.message, result.undo);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Could not log");
      }
    });
  }

  const gutDays = daysSince(insect.last_gut_load);
  const cleanDays = daysSince(insect.last_clean);

  return (
    <article className="rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-white">{insect.label}</h3>
          <p className="mt-1 text-sm text-slate-300">
            {insect.in_stock
              ? `In stock since ${new Date(insect.checked_in_at!).toLocaleDateString()}`
              : "Out of stock"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleStock}
          disabled={pending}
          className={`rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-60 ${
            insect.in_stock
              ? "bg-rose-400 text-slate-950"
              : "bg-emerald-400 text-slate-950"
          }`}
        >
          {insect.in_stock ? "Check out" : "Check in"}
        </button>
      </div>

      {insect.in_stock && insect.tracks_husbandry ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${statusClasses(statusTone(gutDays))}`}>
            <p className="text-sm font-semibold uppercase tracking-wide">Gut load</p>
            <p className="mt-1 text-lg font-bold">{daysSinceLabel(gutDays)}</p>
            <button
              type="button"
              onClick={() => log("gut_load")}
              disabled={pending}
              className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Reset / fed greens
            </button>
          </div>
          <div className={`rounded-2xl border p-4 ${statusClasses(statusTone(cleanDays))}`}>
            <p className="text-sm font-semibold uppercase tracking-wide">Enclosure clean</p>
            <p className="mt-1 text-lg font-bold">{daysSinceLabel(cleanDays)}</p>
            <button
              type="button"
              onClick={() => log("clean")}
              disabled={pending}
              className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Mark cleaned
            </button>
          </div>
        </div>
      ) : null}

      {insect.in_stock && !insect.tracks_husbandry ? (
        <p className="mt-4 text-sm text-slate-400">
          Waxworms are stock-only — no gut-load or cleaning timers.
        </p>
      ) : null}
    </article>
  );
}
