import type { EnvHistoryPoint } from "@/lib/db";
import { GRAPH_PINS, PIN_META, type GraphPin } from "@/lib/microclimate";

type Props = {
  history: EnvHistoryPoint[];
};

const COLORS: Record<GraphPin, string> = {
  v0: "#facc15",
  v1: "#f87171",
  v2: "#60a5fa",
};

export function EnvironmentCharts({ history }: Props) {
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-bold text-white">Last 24 hours</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        {GRAPH_PINS.map((pin) => (
          <ChartCard
            key={pin}
            pin={pin}
            points={history.filter((point) => point.pin === pin)}
          />
        ))}
      </div>
    </section>
  );
}

function ChartCard({
  pin,
  points,
}: {
  pin: GraphPin;
  points: EnvHistoryPoint[];
}) {
  const meta = PIN_META[pin];
  const width = 320;
  const height = 140;
  const padX = 12;
  const padY = 16;

  let path = "";
  let min = 0;
  let max = 1;

  if (points.length > 0) {
    const values = points.map((p) => p.value_num);
    min = Math.min(...values);
    max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const t0 = new Date(points[0].recorded_at).getTime();
    const t1 = new Date(points[points.length - 1].recorded_at).getTime();
    const tSpan = Math.max(t1 - t0, 1);

    path = points
      .map((point, index) => {
        const t = new Date(point.recorded_at).getTime();
        const x = padX + ((t - t0) / tSpan) * (width - padX * 2);
        const y =
          height -
          padY -
          ((point.value_num - min) / span) * (height - padY * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <article className="rounded-3xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-200">{meta.label}</p>
        <p className="text-xs text-slate-400">
          {points.length > 0
            ? `${min.toFixed(1)} – ${max.toFixed(1)}${meta.unit}`
            : "No data yet"}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-36 w-full"
        role="img"
        aria-label={`${meta.label} 24 hour chart`}
      >
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx="16"
          fill="#020617"
        />
        {path ? (
          <path
            d={path}
            fill="none"
            stroke={COLORS[pin]}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            fill="#64748b"
            fontSize="12"
          >
            Waiting for readings…
          </text>
        )}
      </svg>
    </article>
  );
}
