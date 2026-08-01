import { InsectCard } from "@/components/InsectCard";
import { getInsects } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InsectsPage() {
  const insects = await getInsects();

  return (
    <main className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">Feeder insects</h2>
        <p className="mt-2 text-slate-300">
          Check insects in or out of stock. Gut-load and cleaning timers apply
          to crickets, locusts, and dubia. Checking out clears those logs.
        </p>
      </div>
      <div className="grid gap-4">
        {insects.map((insect) => (
          <InsectCard key={insect.key} insect={insect} />
        ))}
      </div>
    </main>
  );
}
