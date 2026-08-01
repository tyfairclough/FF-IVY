export type StatusTone = "green" | "amber" | "red" | "neutral";

export function daysSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const then = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(then.getTime())) return null;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function statusTone(days: number | null): StatusTone {
  if (days === null) return "neutral";
  if (days >= 7) return "red";
  if (days >= 5) return "amber";
  return "green";
}

export function statusClasses(tone: StatusTone): string {
  switch (tone) {
    case "green":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "amber":
      return "bg-amber-100 text-amber-950 border-amber-300";
    case "red":
      return "bg-rose-100 text-rose-950 border-rose-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

export function daysSinceLabel(days: number | null): string {
  if (days === null) return "Never done";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
