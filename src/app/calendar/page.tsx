import { CalendarView } from "@/components/CalendarView";
import { getCalendarSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const data = await getCalendarSnapshot(year, month);

  return <CalendarView year={year} month={month} initialData={data} />;
}
