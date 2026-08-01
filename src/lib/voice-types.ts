import type { InsectKey, InsectLogKind, InsectRow } from "@/lib/db";
import type { TaskKey } from "@/lib/tasks";
import type { LastDoneActivity } from "@/lib/schedule";

export type SoftIntent =
  | { type: "log_feed"; insectKey: InsectKey | null; vague: boolean }
  | { type: "log_task"; taskKey: TaskKey | null; vagueHint: "water" | null }
  | {
      type: "log_insect";
      insectKey: InsectKey | null;
      kind: InsectLogKind | null;
    }
  | { type: "query_needs_today" }
  | {
      type: "query_last_done";
      activity: LastDoneActivity | null;
      insectKey: InsectKey | null;
    };

export type ClarifyOption = {
  id: string;
  label: string;
};

export type PendingClarification = {
  question: string;
  options: ClarifyOption[];
  resolveAs:
    | { type: "log_feed" }
    | { type: "log_task" }
    | { type: "log_insect"; kind: InsectLogKind }
    | { type: "query_last_done"; activity: "gut_load" | "enclosure_clean" };
};

export type VoiceUndo = {
  type: "feed" | "task" | "insect";
  id: number;
};

export type VoiceResultItem = {
  message: string;
  undo?: VoiceUndo;
};

export type VoiceApiResponse =
  | {
      type: "execute";
      spoken: string;
      message: string;
      results: VoiceResultItem[];
      pendingClarification?: PendingClarification;
    }
  | {
      type: "clarify";
      spoken: string;
      message: string;
      results: VoiceResultItem[];
      pendingClarification: PendingClarification;
    }
  | {
      type: "answer";
      spoken: string;
      message: string;
    }
  | {
      type: "error";
      spoken: string;
      message: string;
      results?: VoiceResultItem[];
    };

export type VoiceCareContext = {
  fedToday: boolean;
  nextCycleIndex: number;
  nextSupplement: string;
  lastFeedAt: string | null;
  tasks: Array<{
    key: TaskKey;
    label: string;
    completed_at: string | null;
  }>;
  insects: Array<{
    key: InsectKey;
    label: string;
    in_stock: boolean;
    tracks_husbandry: boolean;
    last_gut_load: string | null;
    last_clean: string | null;
  }>;
};

export function buildVoiceCareContext(input: {
  fedToday: boolean;
  nextCycleIndex: number;
  nextSupplement: string;
  lastFeedAt: string | null;
  tasks: Array<{ key: TaskKey; label: string; completed_at: string | null }>;
  insects: InsectRow[];
}): VoiceCareContext {
  return {
    fedToday: input.fedToday,
    nextCycleIndex: input.nextCycleIndex,
    nextSupplement: input.nextSupplement,
    lastFeedAt: input.lastFeedAt,
    tasks: input.tasks,
    insects: input.insects.map((insect) => ({
      key: insect.key,
      label: insect.label,
      in_stock: insect.in_stock,
      tracks_husbandry: insect.tracks_husbandry,
      last_gut_load: insect.last_gut_load,
      last_clean: insect.last_clean,
    })),
  };
}
