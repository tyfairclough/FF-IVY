"use client";

import { useState, useTransition } from "react";
import { completeFeedAction } from "@/lib/actions";
import { useToast } from "@/components/ToastProvider";

type Props = {
  cycleIndex: number;
  supplement: string;
  lastFedAt: string | null;
  lastCycleIndex: number | null;
  lastSupplement: string | null;
  fedToday: boolean;
};

export function FeedBanner({
  cycleIndex,
  supplement,
  lastFedAt,
  lastCycleIndex,
  lastSupplement,
  fedToday: fedTodayProp,
}: Props) {
  const { pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [fedTodayOptimistic, setFedTodayOptimistic] = useState(false);
  const [seenFedTodayProp, setSeenFedTodayProp] = useState(fedTodayProp);

  // Reset optimistic lock when server props refresh (including undo).
  if (seenFedTodayProp !== fedTodayProp) {
    setSeenFedTodayProp(fedTodayProp);
    setFedTodayOptimistic(false);
  }

  const fedToday = fedTodayProp || fedTodayOptimistic;

  function onFed() {
    if (busy || pending || fedToday) return;
    setBusy(true);
    startTransition(async () => {
      try {
        const result = await completeFeedAction();
        setFedTodayOptimistic(true);
        pushToast(result.message, result.undo);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Could not log feed");
      } finally {
        setBusy(false);
      }
    });
  }

  const disabled = busy || pending || fedToday;
  const displayIndex =
    fedTodayProp && lastCycleIndex != null ? lastCycleIndex : cycleIndex;
  const displaySupplement =
    fedTodayProp && lastSupplement ? lastSupplement : supplement;

  return (
    <section className="rounded-3xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950 to-slate-900 p-6 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
        {fedToday ? "Fed today" : "Next feed"}
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-black text-white">#{displayIndex}</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-300">
            {displaySupplement}
          </p>
          <p className="mt-3 text-sm text-slate-300">
            {fedToday
              ? lastFedAt
                ? `Logged ${new Date(lastFedAt).toLocaleString("en-GB")} — next feed tomorrow`
                : "Done for today — next feed available tomorrow"
              : lastFedAt
                ? `Last feed: ${new Date(lastFedAt).toLocaleString("en-GB")}`
                : "No feeds logged yet — this will be feed #1"}
          </p>
        </div>
        <button
          type="button"
          onClick={onFed}
          disabled={disabled}
          className="min-h-20 min-w-48 rounded-3xl bg-emerald-400 px-8 py-5 text-2xl font-black text-slate-950 shadow-lg transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy || pending ? "Saving…" : fedToday ? "Done for today" : "Fed"}
        </button>
      </div>
    </section>
  );
}
