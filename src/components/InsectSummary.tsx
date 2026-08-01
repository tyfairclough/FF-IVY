import Link from "next/link";
import type { InsectRow } from "@/lib/db";
import { daysSince, daysSinceLabel, statusTone } from "@/lib/status";

export function InsectSummary({ insects }: { insects: InsectRow[] }) {
  const inStock = insects.filter((insect) => insect.in_stock);

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Feeder insects</h2>
        <Link
          href="/insects"
          className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-700"
        >
          Manage
        </Link>
      </div>
      {inStock.length === 0 ? (
        <p className="mt-4 text-slate-300">Nothing in stock right now.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {inStock.map((insect) => {
            const gutDays = daysSince(insect.last_gut_load);
            const cleanDays = daysSince(insect.last_clean);
            return (
              <li
                key={insect.key}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3"
              >
                <p className="font-semibold text-white">{insect.label}</p>
                {insect.tracks_husbandry ? (
                  <p className="mt-1 text-sm text-slate-300">
                    Gut load:{" "}
                    <span className={toneClass(statusTone(gutDays))}>
                      {daysSinceLabel(gutDays)}
                    </span>
                    {" · "}
                    Clean:{" "}
                    <span className={toneClass(statusTone(cleanDays))}>
                      {daysSinceLabel(cleanDays)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">Stock only</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function toneClass(tone: ReturnType<typeof statusTone>) {
  if (tone === "red") return "text-rose-300 font-semibold";
  if (tone === "amber") return "text-amber-300 font-semibold";
  if (tone === "green") return "text-emerald-300";
  return "text-slate-400";
}
