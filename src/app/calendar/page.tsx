import { CalendarGrid } from "@/components/CalendarGrid";
import { FeedBanner } from "@/components/FeedBanner";
import { getFeedsForMonth, getNextFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const [feeds, nextFeed] = await Promise.all([
    getFeedsForMonth(year, month),
    getNextFeed(),
  ]);

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
