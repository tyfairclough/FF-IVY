import { EnvironmentCharts } from "@/components/EnvironmentCharts";
import { EnvironmentStatus } from "@/components/EnvironmentStatus";
import { FeedBanner } from "@/components/FeedBanner";
import { InsectSummary } from "@/components/InsectSummary";
import { TaskCard } from "@/components/TaskCard";
import {
  getEnvHistory,
  getEnvLatest,
  getInsects,
  getNextFeed,
  getTaskStatuses,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [nextFeed, tasks, insects, envLatest, envHistory] = await Promise.all([
    getNextFeed(),
    getTaskStatuses(),
    getInsects(),
    getEnvLatest(),
    getEnvHistory(24),
  ]);

  return (
    <main className="space-y-6">
      <FeedBanner
        cycleIndex={nextFeed.cycle_index}
        supplement={nextFeed.supplement}
        lastFedAt={nextFeed.last?.fed_at ?? null}
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
