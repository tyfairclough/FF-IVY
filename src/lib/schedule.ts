import type { InsectRow } from "@/lib/db";
import { daysSince, daysSinceLabel } from "@/lib/status";
import { CARE_TASKS, type TaskKey } from "@/lib/tasks";

/** Typical service intervals in calendar days (Europe/London via daysSince). */
export const TASK_INTERVAL_DAYS: Record<TaskKey, number> = {
  rainmaker_water: 2,
  humidifier_water: 2,
  env_check: 7,
  habitat_clean: 30,
};

export const INSECT_INTERVAL_DAYS = {
  gut_load: 3,
  clean: 7,
} as const;

export type InsectHusbandryKind = keyof typeof INSECT_INTERVAL_DAYS;

export function isDue(
  lastAt: string | null | undefined,
  intervalDays: number,
): boolean {
  const days = daysSince(lastAt);
  if (days === null) return true;
  return days >= intervalDays;
}

export function formatLastDone(lastAt: string | null | undefined): string {
  const days = daysSince(lastAt);
  if (days === null) return "never done";
  const relative = daysSinceLabel(days);
  if (!lastAt) return relative;
  const when = new Date(lastAt);
  if (Number.isNaN(when.getTime())) return relative;
  const absolute = when.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${relative} (${absolute})`;
}

export type NeedItem = {
  id: string;
  label: string;
  detail: string;
};

export type NeedsTodayInput = {
  fedToday: boolean;
  nextSupplement: string;
  nextCycleIndex: number;
  tasks: Array<{ key: TaskKey; label: string; completed_at: string | null }>;
  insects: InsectRow[];
};

export function getNeedsToday(input: NeedsTodayInput): NeedItem[] {
  const needs: NeedItem[] = [];

  if (!input.fedToday) {
    needs.push({
      id: "feed",
      label: "Food",
      detail: `Feed #${input.nextCycleIndex} with ${input.nextSupplement}`,
    });
  }

  for (const task of input.tasks) {
    const interval = TASK_INTERVAL_DAYS[task.key];
    if (!isDue(task.completed_at, interval)) continue;
    const days = daysSince(task.completed_at);
    needs.push({
      id: `task:${task.key}`,
      label: task.label,
      detail:
        days === null
          ? "Never done"
          : `Last done ${daysSinceLabel(days)} (every ${interval} days)`,
    });
  }

  for (const insect of input.insects) {
    if (!insect.in_stock || !insect.tracks_husbandry) continue;

    if (isDue(insect.last_gut_load, INSECT_INTERVAL_DAYS.gut_load)) {
      const days = daysSince(insect.last_gut_load);
      needs.push({
        id: `insect:${insect.key}:gut_load`,
        label: `${insect.label} gut load`,
        detail:
          days === null
            ? "Never done"
            : `Last done ${daysSinceLabel(days)} (every ${INSECT_INTERVAL_DAYS.gut_load} days)`,
      });
    }

    if (isDue(insect.last_clean, INSECT_INTERVAL_DAYS.clean)) {
      const days = daysSince(insect.last_clean);
      needs.push({
        id: `insect:${insect.key}:clean`,
        label: `${insect.label} enclosure clean`,
        detail:
          days === null
            ? "Never done"
            : `Last done ${daysSinceLabel(days)} (every ${INSECT_INTERVAL_DAYS.clean} days)`,
      });
    }
  }

  return needs;
}

export function formatNeedsTodaySpeech(needs: NeedItem[]): string {
  if (needs.length === 0) {
    return "Ivy is up to date — no food or overdue care today.";
  }
  const parts = needs.map((need) => `${need.label}: ${need.detail}`);
  return `Ivy needs: ${parts.join(". ")}.`;
}

export type LastDoneActivity =
  | "feed"
  | TaskKey
  | "gut_load"
  | "enclosure_clean";

export function isLastDoneActivity(value: string): value is LastDoneActivity {
  if (value === "feed" || value === "gut_load" || value === "enclosure_clean") {
    return true;
  }
  return CARE_TASKS.some((task) => task.key === value);
}

export function lastDoneLabel(
  activity: LastDoneActivity,
  insectLabel?: string,
): string {
  switch (activity) {
    case "feed":
      return "feeding Ivy";
    case "gut_load":
      return insectLabel ? `${insectLabel} gut load` : "gut load";
    case "enclosure_clean":
      return insectLabel
        ? `${insectLabel} enclosure clean`
        : "insect enclosure clean";
    default:
      return CARE_TASKS.find((task) => task.key === activity)?.label ?? activity;
  }
}
