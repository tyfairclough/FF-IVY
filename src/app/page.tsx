import { TodayView } from "@/components/TodayView";
import { getTodaySnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const data = await getTodaySnapshot();
  return <TodayView initialData={data} />;
}
