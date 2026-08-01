import { InsectsView } from "@/components/InsectsView";
import { getInsectsSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InsectsPage() {
  const data = await getInsectsSnapshot();
  return <InsectsView initialData={data} />;
}
