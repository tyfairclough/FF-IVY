"use client";

import { useTransition } from "react";
import { completeTaskAction } from "@/lib/actions";
import { useToast } from "@/components/ToastProvider";
import {
  daysSince,
  daysSinceLabel,
  statusClasses,
  statusTone,
} from "@/lib/status";

type Props = {
  taskKey: string;
  label: string;
  completedAt: string | null;
};

export function TaskCard({ taskKey, label, completedAt }: Props) {
  const { pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const days = daysSince(completedAt);
  const tone = statusTone(days);

  function onComplete() {
    startTransition(async () => {
      try {
        const result = await completeTaskAction(taskKey);
        pushToast(result.message, result.undo);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : "Could not log task");
      }
    });
  }

  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm ${statusClasses(tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{label}</h3>
          <p className="mt-2 text-base font-medium">{daysSinceLabel(days)}</p>
          {days !== null && days >= 7 ? (
            <p className="mt-1 text-sm font-semibold">Overdue nudge (7+ days)</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onComplete}
          disabled={pending}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Done"}
        </button>
      </div>
    </article>
  );
}
