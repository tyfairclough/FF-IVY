"use client";

import { EnvironmentCharts } from "@/components/EnvironmentCharts";
import { EnvironmentStatus } from "@/components/EnvironmentStatus";
import { FeedBanner } from "@/components/FeedBanner";
import { InsectSummary } from "@/components/InsectSummary";
import { TaskCard } from "@/components/TaskCard";
import { usePollingFetch } from "@/hooks/usePollingFetch";
import type { TodaySnapshot } from "@/lib/queries";

export function TodayView({ initialData }: { initialData: TodaySnapshot }) {
  const data = usePollingFetch("/api/today", initialData);
  const { nextFeed, tasks, insects, envLatest, envHistory } = data;

  return (
    <main className="space-y-6">
      <FeedBanner
        cycleIndex={nextFeed.cycle_index}
        supplement={nextFeed.supplement}
        lastFedAt={nextFeed.last?.fed_at ?? null}
        lastCycleIndex={nextFeed.last?.cycle_index ?? null}
        lastSupplement={nextFeed.last?.supplement ?? null}
        fedToday={nextFeed.fedToday}
      />

      <EnvironmentStatus readings={envLatest} />
      <EnvironmentCharts history={envHistory} />

      <section>
        <h2 className="mb-3 text-2xl font-bold text-white">Care tasks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.key}
              taskKey={task.key}
              label={task.label}
              completedAt={task.completed_at}
            />
          ))}
        </div>
      </section>

      <InsectSummary insects={insects} />
    </main>
  );
}
