import {
  type CycleIndex,
  type FeedLog,
  isFedToday,
  nextCycleIndex,
  supplementForIndex,
} from "@/lib/feeding";
import {
  getSql,
  type EnvHistoryPoint,
  type EnvLatestRow,
  type InsectKey,
  type InsectLogKind,
  type InsectRow,
} from "@/lib/db";
import { CARE_TASKS, type TaskKey } from "@/lib/tasks";

export async function getLatestFeed(): Promise<FeedLog | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, fed_at, cycle_index, supplement
    FROM feed_logs
    ORDER BY fed_at DESC, id DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: Number(row.id),
    fed_at: String(row.fed_at),
    cycle_index: Number(row.cycle_index) as CycleIndex,
    supplement: String(row.supplement),
  };
}

export async function getNextFeed() {
  const latest = await getLatestFeed();
  const cycle_index = nextCycleIndex(latest?.cycle_index);
  const fedToday = isFedToday(latest?.fed_at);
  return {
    cycle_index,
    supplement: supplementForIndex(cycle_index),
    last: latest,
    fedToday,
  };
}

export async function logFeed() {
  const next = await getNextFeed();
  if (next.fedToday) {
    throw new Error("Already fed today — next feed available tomorrow");
  }
  const sql = getSql();
  const rows = await sql`
    INSERT INTO feed_logs (cycle_index, supplement)
    VALUES (${next.cycle_index}, ${next.supplement})
    RETURNING id, fed_at, cycle_index, supplement
  `;
  const row = rows[0];
  return {
    id: Number(row.id),
    fed_at: String(row.fed_at),
    cycle_index: Number(row.cycle_index) as CycleIndex,
    supplement: String(row.supplement),
  };
}

export async function undoFeed(id: number) {
  const sql = getSql();
  await sql`DELETE FROM feed_logs WHERE id = ${id}`;
}

export async function getFeedsForMonth(year: number, month: number) {
  const sql = getSql();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const rows = await sql`
    SELECT id, fed_at, cycle_index, supplement
    FROM feed_logs
    WHERE fed_at >= ${start.toISOString()} AND fed_at < ${end.toISOString()}
    ORDER BY fed_at ASC, id ASC
  `;
  return rows.map((row) => ({
    id: Number(row.id),
    fed_at: String(row.fed_at),
    cycle_index: Number(row.cycle_index) as CycleIndex,
    supplement: String(row.supplement),
  }));
}

export async function getTaskStatuses() {
  const sql = getSql();
  const rows = await sql`
    SELECT DISTINCT ON (task_key) task_key, completed_at
    FROM task_logs
    ORDER BY task_key, completed_at DESC
  `;
  const latest = new Map(
    rows.map((row) => [String(row.task_key), String(row.completed_at)]),
  );
  return CARE_TASKS.map((task) => ({
    key: task.key,
    label: task.label,
    completed_at: latest.get(task.key) ?? null,
  }));
}

export async function logTask(taskKey: TaskKey) {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO task_logs (task_key)
    VALUES (${taskKey})
    RETURNING id, task_key, completed_at
  `;
  const row = rows[0];
  return {
    id: Number(row.id),
    task_key: String(row.task_key) as TaskKey,
    completed_at: String(row.completed_at),
  };
}

export async function undoTask(id: number) {
  const sql = getSql();
  await sql`DELETE FROM task_logs WHERE id = ${id}`;
}

export async function getInsects(): Promise<InsectRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      i.key,
      i.label,
      i.in_stock,
      i.checked_in_at,
      i.tracks_husbandry,
      (
        SELECT il.logged_at
        FROM insect_logs il
        WHERE il.insect_key = i.key AND il.kind = 'gut_load'
        ORDER BY il.logged_at DESC
        LIMIT 1
      ) AS last_gut_load,
      (
        SELECT il.logged_at
        FROM insect_logs il
        WHERE il.insect_key = i.key AND il.kind = 'clean'
        ORDER BY il.logged_at DESC
        LIMIT 1
      ) AS last_clean
    FROM insects i
    ORDER BY
      CASE i.key
        WHEN 'cricket' THEN 1
        WHEN 'locust' THEN 2
        WHEN 'dubia' THEN 3
        WHEN 'waxworm' THEN 4
        ELSE 99
      END
  `;
  return rows.map((row) => ({
    key: String(row.key) as InsectKey,
    label: String(row.label),
    in_stock: Boolean(row.in_stock),
    checked_in_at: row.checked_in_at ? String(row.checked_in_at) : null,
    tracks_husbandry: Boolean(row.tracks_husbandry),
    last_gut_load: row.last_gut_load ? String(row.last_gut_load) : null,
    last_clean: row.last_clean ? String(row.last_clean) : null,
  }));
}

export async function setInsectStock(key: InsectKey, inStock: boolean) {
  const sql = getSql();
  if (!inStock) {
    await sql`DELETE FROM insect_logs WHERE insect_key = ${key}`;
    await sql`
      UPDATE insects
      SET in_stock = FALSE, checked_in_at = NULL
      WHERE key = ${key}
    `;
  } else {
    await sql`
      UPDATE insects
      SET in_stock = TRUE, checked_in_at = NOW()
      WHERE key = ${key}
    `;
  }
  const insects = await getInsects();
  return insects.find((insect) => insect.key === key)!;
}

export async function logInsect(key: InsectKey, kind: InsectLogKind) {
  const sql = getSql();
  const existing = await sql`
    SELECT key, in_stock, tracks_husbandry FROM insects WHERE key = ${key}
  `;
  if (!existing[0]) {
    throw new Error("Unknown insect");
  }
  if (!existing[0].in_stock) {
    throw new Error("Insect is not in stock");
  }
  if (!existing[0].tracks_husbandry) {
    throw new Error("This insect does not track husbandry");
  }
  const rows = await sql`
    INSERT INTO insect_logs (insect_key, kind)
    VALUES (${key}, ${kind})
    RETURNING id, insect_key, kind, logged_at
  `;
  const row = rows[0];
  return {
    id: Number(row.id),
    insect_key: String(row.insect_key) as InsectKey,
    kind: String(row.kind) as InsectLogKind,
    logged_at: String(row.logged_at),
  };
}

export async function undoInsectLog(id: number) {
  const sql = getSql();
  await sql`DELETE FROM insect_logs WHERE id = ${id}`;
}

export async function upsertEnvReading(input: {
  pin: string;
  stream_name: string;
  value_raw: string;
  value_num: number | null;
  recorded_at: Date;
  device_id: string | null;
  device_name: string | null;
  writeHistory: boolean;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO env_latest (
      pin, stream_name, value_raw, value_num, recorded_at, device_id, device_name
    )
    VALUES (
      ${input.pin},
      ${input.stream_name},
      ${input.value_raw},
      ${input.value_num},
      ${input.recorded_at.toISOString()},
      ${input.device_id},
      ${input.device_name}
    )
    ON CONFLICT (pin) DO UPDATE SET
      stream_name = EXCLUDED.stream_name,
      value_raw = EXCLUDED.value_raw,
      value_num = EXCLUDED.value_num,
      recorded_at = EXCLUDED.recorded_at,
      device_id = EXCLUDED.device_id,
      device_name = EXCLUDED.device_name
  `;

  if (input.writeHistory && input.value_num !== null) {
    const minuteBucket = new Date(input.recorded_at);
    minuteBucket.setUTCSeconds(0, 0);
    await sql`
      INSERT INTO env_history (pin, recorded_at, value_num, minute_bucket)
      VALUES (
        ${input.pin},
        ${input.recorded_at.toISOString()},
        ${input.value_num},
        ${minuteBucket.toISOString()}
      )
      ON CONFLICT (pin, minute_bucket) DO UPDATE SET
        value_num = EXCLUDED.value_num,
        recorded_at = EXCLUDED.recorded_at
    `;
    await sql`
      DELETE FROM env_history
      WHERE pin = ${input.pin}
        AND recorded_at < NOW() - INTERVAL '7 days'
    `;
  }
}

export async function getEnvLatest(): Promise<EnvLatestRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT pin, stream_name, value_raw, value_num, recorded_at, device_id, device_name
    FROM env_latest
    ORDER BY pin ASC
  `;
  return rows.map((row) => ({
    pin: String(row.pin),
    stream_name: String(row.stream_name),
    value_raw: String(row.value_raw),
    value_num:
      row.value_num === null || row.value_num === undefined
        ? null
        : Number(row.value_num),
    recorded_at: String(row.recorded_at),
    device_id: row.device_id ? String(row.device_id) : null,
    device_name: row.device_name ? String(row.device_name) : null,
  }));
}

export async function getEnvHistory(hours = 24): Promise<EnvHistoryPoint[]> {
  const sql = getSql();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await sql`
    SELECT pin, recorded_at, value_num
    FROM env_history
    WHERE recorded_at >= ${since}
      AND pin IN ('v0', 'v1', 'v2')
    ORDER BY recorded_at ASC
  `;
  return rows.map((row) => ({
    pin: String(row.pin),
    recorded_at: String(row.recorded_at),
    value_num: Number(row.value_num),
  }));
}
