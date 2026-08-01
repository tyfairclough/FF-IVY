"use client";

import { CalendarGrid } from "@/components/CalendarGrid";
import { FeedBanner } from "@/components/FeedBanner";
import { usePollingFetch } from "@/hooks/usePollingFetch";
import type { CalendarSnapshot } from "@/lib/queries";

export function CalendarView({
  year,
  month,
  initialData,
}: {
  year: number;
  month: number;
  initialData: CalendarSnapshot;
}) {
  const data = usePollingFetch(
    `/api/calendar?year=${year}&month=${month}`,
    initialData,
  );
  const { feeds, nextFeed } = data;

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
      <CalendarGrid year={year} month={month} feeds={feeds} />
    </main>
  );
}
