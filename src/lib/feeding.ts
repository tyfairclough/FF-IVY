export const CYCLE_LENGTH = 8;

export const SUPPLEMENT_BY_INDEX = {
  1: "EarthPro-A",
  2: "EarthPro-A",
  3: "EarthPro-A",
  4: "CalciumPro Mg",
  5: "EarthPro-A",
  6: "EarthPro-A",
  7: "EarthPro-A",
  8: "ReVitaliseD3",
} as const;

export type CycleIndex = keyof typeof SUPPLEMENT_BY_INDEX;
export type Supplement = (typeof SUPPLEMENT_BY_INDEX)[CycleIndex];

export type FeedLog = {
  id: number;
  fed_at: string;
  cycle_index: CycleIndex;
  supplement: string;
};

export function nextCycleIndex(lastIndex: number | null | undefined): CycleIndex {
  if (!lastIndex || lastIndex < 1 || lastIndex > CYCLE_LENGTH) {
    return 1;
  }
  return (((lastIndex % CYCLE_LENGTH) + 1) as CycleIndex);
}

export function supplementForIndex(index: CycleIndex): Supplement {
  return SUPPLEMENT_BY_INDEX[index];
}

export function shortSupplement(name: string): string {
  if (name === "EarthPro-A") return "A";
  if (name === "CalciumPro Mg") return "CaMg";
  if (name === "ReVitaliseD3") return "D3";
  return name;
}

/** Calendar day in Europe/London (YYYY-MM-DD), used for the one-feed-per-day rule. */
export function calendarDayKey(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function isFedToday(fedAt: string | null | undefined): boolean {
  if (!fedAt) return false;
  const fedDay = calendarDayKey(fedAt);
  return fedDay !== "" && fedDay === calendarDayKey();
}
