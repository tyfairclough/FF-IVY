import type { InsectKey, InsectLogKind, InsectRow } from "@/lib/db";
import {
  formatLastDone,
  formatNeedsTodaySpeech,
  getNeedsToday,
  lastDoneLabel,
} from "@/lib/schedule";
import { CARE_TASKS, type TaskKey } from "@/lib/tasks";
import {
  matchClarificationWithLlm,
  parseVoiceIntents,
} from "@/lib/voice-llm";
import type {
  PendingClarification,
  SoftIntent,
  VoiceApiResponse,
  VoiceCareContext,
  VoiceResultItem,
} from "@/lib/voice-types";
import { logFeed, logInsect, logTask } from "@/lib/queries";

function husbandryInStock(insects: InsectRow[]): InsectRow[] {
  return insects.filter(
    (insect) => insect.in_stock && insect.tracks_husbandry,
  );
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function matchClarificationLocally(
  transcript: string,
  pending: PendingClarification,
): string | null {
  const text = normalizeText(transcript);
  if (!text) return null;

  for (const option of pending.options) {
    const id = normalizeText(option.id);
    const label = normalizeText(option.label);
    if (text === id || text === label) return option.id;
    if (text.includes(label) || text.includes(id)) return option.id;
    if (!id.endsWith("s") && text.includes(`${id}s`)) return option.id;
  }
  return null;
}

async function resolveOptionId(
  transcript: string,
  pending: PendingClarification,
): Promise<string | null> {
  const local = matchClarificationLocally(transcript, pending);
  if (local) return local;
  return matchClarificationWithLlm({ transcript, pending });
}

async function executeFeed(insectLabel?: string): Promise<VoiceResultItem> {
  const log = await logFeed();
  const insectBit = insectLabel ? ` (${insectLabel})` : "";
  return {
    message: `Logged feed #${log.cycle_index} (${log.supplement})${insectBit}`,
    undo: { type: "feed", id: log.id },
  };
}

async function executeTask(taskKey: TaskKey): Promise<VoiceResultItem> {
  const log = await logTask(taskKey);
  const label =
    CARE_TASKS.find((task) => task.key === taskKey)?.label ??
    taskKey.replaceAll("_", " ");
  return {
    message: `Logged ${label}`,
    undo: { type: "task", id: log.id },
  };
}

async function executeInsect(
  key: InsectKey,
  kind: InsectLogKind,
): Promise<VoiceResultItem> {
  const log = await logInsect(key, kind);
  const label = kind === "gut_load" ? "gut load" : "enclosure clean";
  return {
    message: `Logged ${label} for ${key}`,
    undo: { type: "insect", id: log.id },
  };
}

type ResolvePiece =
  | { status: "done"; result: VoiceResultItem }
  | { status: "clarify"; pending: PendingClarification }
  | { status: "answer"; spoken: string; message: string }
  | { status: "error"; message: string };

function feedClarify(insects: InsectRow[]): PendingClarification {
  return {
    question: "Which insect did you feed Ivy?",
    options: insects.map((insect) => ({
      id: insect.key,
      label: insect.label,
    })),
    resolveAs: { type: "log_feed" },
  };
}

function waterClarify(): PendingClarification {
  return {
    question: "Rainmaker water or humidifier water?",
    options: [
      { id: "rainmaker_water", label: "Rainmaker water" },
      { id: "humidifier_water", label: "Humidifier water" },
    ],
    resolveAs: { type: "log_task" },
  };
}

function insectClarify(
  insects: InsectRow[],
  kind: InsectLogKind,
): PendingClarification {
  const action = kind === "gut_load" ? "gut load" : "enclosure clean";
  return {
    question: `Which insect did you ${action}?`,
    options: insects.map((insect) => ({
      id: insect.key,
      label: insect.label,
    })),
    resolveAs: { type: "log_insect", kind },
  };
}

async function resolveLogFeed(
  intent: Extract<SoftIntent, { type: "log_feed" }>,
  insects: InsectRow[],
): Promise<ResolvePiece> {
  const stock = husbandryInStock(insects);

  if (intent.insectKey) {
    const named = insects.find((insect) => insect.key === intent.insectKey);
    if (!named) {
      return { status: "error", message: "Unknown insect" };
    }
    if (!named.in_stock) {
      return {
        status: "error",
        message: `${named.label} are not checked in`,
      };
    }
    try {
      return { status: "done", result: await executeFeed(named.label) };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Could not log feed",
      };
    }
  }

  if (stock.length >= 2) {
    return { status: "clarify", pending: feedClarify(stock) };
  }

  try {
    const label = stock.length === 1 ? stock[0].label : undefined;
    return { status: "done", result: await executeFeed(label) };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not log feed",
    };
  }
}

async function resolveLogTask(
  intent: Extract<SoftIntent, { type: "log_task" }>,
): Promise<ResolvePiece> {
  if (intent.taskKey) {
    try {
      return { status: "done", result: await executeTask(intent.taskKey) };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Could not log task",
      };
    }
  }

  if (intent.vagueHint === "water") {
    return { status: "clarify", pending: waterClarify() };
  }

  return {
    status: "error",
    message: "Which care task did you mean?",
  };
}

async function resolveLogInsect(
  intent: Extract<SoftIntent, { type: "log_insect" }>,
  insects: InsectRow[],
): Promise<ResolvePiece> {
  const stock = husbandryInStock(insects);
  const kind = intent.kind;

  if (!kind) {
    return {
      status: "error",
      message: "Did you gut load or clean an insect enclosure?",
    };
  }

  if (intent.insectKey) {
    const named = insects.find((insect) => insect.key === intent.insectKey);
    if (!named) {
      return { status: "error", message: "Unknown insect" };
    }
    if (!named.in_stock) {
      return {
        status: "error",
        message: `${named.label} are not checked in`,
      };
    }
    if (!named.tracks_husbandry) {
      return {
        status: "error",
        message: `${named.label} do not track husbandry`,
      };
    }
    try {
      return { status: "done", result: await executeInsect(named.key, kind) };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not log insect care",
      };
    }
  }

  if (stock.length === 0) {
    return {
      status: "error",
      message: "No feeder insects are checked in",
    };
  }
  if (stock.length === 1) {
    try {
      return {
        status: "done",
        result: await executeInsect(stock[0].key, kind),
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not log insect care",
      };
    }
  }

  return { status: "clarify", pending: insectClarify(stock, kind) };
}

function resolveNeedsToday(
  context: VoiceCareContext,
  insects: InsectRow[],
): ResolvePiece {
  const needs = getNeedsToday({
    fedToday: context.fedToday,
    nextSupplement: context.nextSupplement,
    nextCycleIndex: context.nextCycleIndex,
    tasks: context.tasks,
    insects,
  });
  const spoken = formatNeedsTodaySpeech(needs);
  return { status: "answer", spoken, message: spoken };
}

function resolveLastDone(
  intent: Extract<SoftIntent, { type: "query_last_done" }>,
  context: VoiceCareContext,
  insects: InsectRow[],
): ResolvePiece {
  if (!intent.activity) {
    return {
      status: "error",
      message: "Which activity should I look up?",
    };
  }

  const activity = intent.activity;
  let lastAt: string | null = null;
  let insectLabel: string | undefined;

  if (activity === "feed") {
    lastAt = context.lastFeedAt;
  } else if (activity === "gut_load" || activity === "enclosure_clean") {
    const stock = husbandryInStock(insects);
    let target: InsectRow | undefined;
    if (intent.insectKey) {
      target = insects.find((insect) => insect.key === intent.insectKey);
      if (!target) {
        return { status: "error", message: "Unknown insect" };
      }
    } else if (stock.length === 1) {
      target = stock[0];
    } else if (stock.length === 0) {
      return {
        status: "error",
        message: "No feeder insects are checked in",
      };
    } else {
      return {
        status: "clarify",
        pending: {
          question:
            activity === "gut_load"
              ? "Last gut load for which insect?"
              : "Last enclosure clean for which insect?",
          options: stock.map((insect) => ({
            id: insect.key,
            label: insect.label,
          })),
          resolveAs: { type: "query_last_done", activity },
        },
      };
    }
    insectLabel = target.label;
    lastAt =
      activity === "gut_load" ? target.last_gut_load : target.last_clean;
  } else {
    const task = context.tasks.find((item) => item.key === activity);
    lastAt = task?.completed_at ?? null;
  }

  const label = lastDoneLabel(activity, insectLabel);
  const when = formatLastDone(lastAt);
  const spoken = `The last ${label} was ${when}.`;
  return { status: "answer", spoken, message: spoken };
}

async function resolveSoftIntent(
  intent: SoftIntent,
  context: VoiceCareContext,
  insects: InsectRow[],
): Promise<ResolvePiece> {
  switch (intent.type) {
    case "log_feed":
      return resolveLogFeed(intent, insects);
    case "log_task":
      return resolveLogTask(intent);
    case "log_insect":
      return resolveLogInsect(intent, insects);
    case "query_needs_today":
      return resolveNeedsToday(context, insects);
    case "query_last_done":
      return resolveLastDone(intent, context, insects);
  }
}

function combineMessages(results: VoiceResultItem[], errors: string[]): string {
  return [...results.map((result) => result.message), ...errors].join(". ");
}

export async function handleVoiceTurn(input: {
  transcript: string;
  pendingClarification?: PendingClarification | null;
  context: VoiceCareContext;
  insects: InsectRow[];
}): Promise<VoiceApiResponse> {
  const { transcript, context, insects } = input;

  if (input.pendingClarification) {
    const pending = input.pendingClarification;
    const optionId = await resolveOptionId(transcript, pending);
    if (!optionId) {
      return {
        type: "clarify",
        spoken: pending.question,
        message: `I didn't catch that. ${pending.question}`,
        results: [],
        pendingClarification: pending,
      };
    }

    try {
      if (pending.resolveAs.type === "query_last_done") {
        const activity = pending.resolveAs.activity;
        const target = insects.find((insect) => insect.key === optionId);
        if (!target) {
          return {
            type: "error",
            spoken: "Unknown insect.",
            message: "Unknown insect",
          };
        }
        const lastAt =
          activity === "gut_load" ? target.last_gut_load : target.last_clean;
        const spoken = `The last ${lastDoneLabel(activity, target.label)} was ${formatLastDone(lastAt)}.`;
        return { type: "answer", spoken, message: spoken };
      }

      let result: VoiceResultItem;
      if (pending.resolveAs.type === "log_feed") {
        const named = insects.find((insect) => insect.key === optionId);
        result = await executeFeed(named?.label);
      } else if (pending.resolveAs.type === "log_task") {
        if (!CARE_TASKS.some((task) => task.key === optionId)) {
          return {
            type: "error",
            spoken: "Unknown task.",
            message: "Unknown task",
          };
        }
        result = await executeTask(optionId as TaskKey);
      } else {
        result = await executeInsect(
          optionId as InsectKey,
          pending.resolveAs.kind,
        );
      }
      return {
        type: "execute",
        spoken: result.message,
        message: result.message,
        results: [result],
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not complete that";
      return { type: "error", spoken: message, message };
    }
  }

  const intents = await parseVoiceIntents({ transcript, context });
  if (intents.length === 0) {
    return {
      type: "error",
      spoken: `I heard “${transcript}” but didn't catch a care action.`,
      message: `Heard “${transcript}” — nothing to do`,
    };
  }

  const results: VoiceResultItem[] = [];
  const errors: string[] = [];
  let clarify: PendingClarification | null = null;
  let answer: { spoken: string; message: string } | null = null;

  for (const intent of intents) {
    const piece = await resolveSoftIntent(intent, context, insects);

    if (piece.status === "done") {
      results.push(piece.result);
    } else if (piece.status === "error") {
      errors.push(piece.message);
    } else if (piece.status === "answer") {
      answer = { spoken: piece.spoken, message: piece.message };
    } else if (piece.status === "clarify" && !clarify) {
      // Execute clear siblings; keep the first clarification for this turn.
      clarify = piece.pending;
    }
  }

  if (answer && results.length === 0 && !clarify && errors.length === 0) {
    return { type: "answer", spoken: answer.spoken, message: answer.message };
  }

  if (clarify) {
    const spoken = [
      ...results.map((result) => result.message),
      ...errors,
      clarify.question,
    ].join(". ");
    return {
      type: "clarify",
      spoken,
      message: combineMessages(results, errors) || clarify.question,
      results,
      pendingClarification: clarify,
    };
  }

  if (results.length === 0 && errors.length > 0) {
    const message = errors.join(". ");
    return { type: "error", spoken: message, message };
  }

  if (results.length === 0 && answer) {
    return { type: "answer", spoken: answer.spoken, message: answer.message };
  }

  if (results.length === 0) {
    return {
      type: "error",
      spoken: "Nothing to log.",
      message: "Nothing to log",
    };
  }

  const message = combineMessages(results, errors);
  const spoken = answer ? `${message}. ${answer.spoken}` : message;
  return {
    type: "execute",
    spoken,
    message,
    results,
  };
}
