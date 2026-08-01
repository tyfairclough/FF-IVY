import Link from "next/link";
import type { FeedLog } from "@/lib/feeding";
import { shortSupplement } from "@/lib/feeding";

type Props = {
  year: number;
  month: number;
  feeds: FeedLog[];
};

export function CalendarGrid({ year, month, feeds }: Props) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = (first.getDay() + 6) % 7; // Monday-first
  const monthLabel = first.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const byDay = new Map<number, FeedLog[]>();
  for (const feed of feeds) {
    const day = new Date(feed.fed_at).getDate();
    const list = byDay.get(day) ?? [];
    list.push(feed);
    byDay.set(day, list);
  }

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href={`/calendar?year=${prev.year}&month=${prev.month}`}
          className="rounded-2xl bg-slate-800 px-4 py-3 font-semibold text-white"
        >
          Prev
        </Link>
        <h2 className="text-2xl font-bold text-white">{monthLabel}</h2>
        <Link
          href={`/calendar?year=${next.year}&month=${next.month}`}
          className="rounded-2xl bg-slate-800 px-4 py-3 font-semibold text-white"
        >
          Next
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-2">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-24 rounded-2xl bg-slate-950/40" />;
          }
          const dayFeeds = byDay.get(day) ?? [];
          return (
            <div
              key={day}
              className="min-h-24 rounded-2xl border border-slate-700 bg-slate-950 p-2"
            >
              <p className="text-sm font-semibold text-slate-300">{day}</p>
              <div className="mt-1 space-y-1">
                {dayFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="rounded-lg bg-emerald-500/20 px-1.5 py-1 text-[11px] font-semibold leading-tight text-emerald-200"
                    title={`${feed.supplement} (feed #${feed.cycle_index})`}
                  >
                    #{feed.cycle_index} {shortSupplement(feed.supplement)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-slate-400">
        History only — days without a logged feed stay blank. The next feed is
        shown on the Today screen, not projected here.
      </p>
    </section>
  );
}
