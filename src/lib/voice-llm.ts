import OpenAI from "openai";
import type { InsectKey, InsectLogKind } from "@/lib/db";
import {
  isLastDoneActivity,
  type LastDoneActivity,
} from "@/lib/schedule";
import { isTaskKey, type TaskKey } from "@/lib/tasks";
import type {
  PendingClarification,
  SoftIntent,
  VoiceCareContext,
} from "@/lib/voice-types";

const INSECT_KEYS = ["cricket", "locust", "dubia", "waxworm"] as const;
const TASK_KEYS = [
  "habitat_clean",
  "rainmaker_water",
  "humidifier_water",
  "env_check",
] as const;
const ACTIVITIES = [
  "feed",
  "habitat_clean",
  "rainmaker_water",
  "humidifier_water",
  "env_check",
  "gut_load",
  "enclosure_clean",
] as const;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

function isInsectKey(value: unknown): value is InsectKey {
  return (
    typeof value === "string" &&
    (INSECT_KEYS as readonly string[]).includes(value)
  );
}

function isInsectKind(value: unknown): value is InsectLogKind {
  return value === "gut_load" || value === "clean";
}

type LlmIntentRaw = {
  kind?: string;
  taskKey?: string | null;
  insectKey?: string | null;
  insectKind?: string | null;
  activity?: string | null;
  vagueHint?: string | null;
  vague?: boolean | null;
};

function normalizeIntent(raw: LlmIntentRaw): SoftIntent | null {
  const kind = raw.kind;
  if (kind === "log_feed") {
    return {
      type: "log_feed",
      insectKey: isInsectKey(raw.insectKey) ? raw.insectKey : null,
      vague: Boolean(raw.vague) || !isInsectKey(raw.insectKey),
    };
  }
  if (kind === "log_task") {
    const taskKey = isTaskKey(raw.taskKey ?? "") ? (raw.taskKey as TaskKey) : null;
    const vagueHint = raw.vagueHint === "water" ? "water" : null;
    return { type: "log_task", taskKey, vagueHint };
  }
  if (kind === "log_insect") {
    return {
      type: "log_insect",
      insectKey: isInsectKey(raw.insectKey) ? raw.insectKey : null,
      kind: isInsectKind(raw.insectKind)
        ? raw.insectKind
        : raw.insectKind === "enclosure_clean"
          ? "clean"
          : null,
    };
  }
  if (kind === "query_needs_today") {
    return { type: "query_needs_today" };
  }
  if (kind === "query_last_done") {
    const activity =
      typeof raw.activity === "string" && isLastDoneActivity(raw.activity)
        ? (raw.activity as LastDoneActivity)
        : null;
    return {
      type: "query_last_done",
      activity,
      insectKey: isInsectKey(raw.insectKey) ? raw.insectKey : null,
    };
  }
  return null;
}

const SYSTEM_PROMPT = `You extract care intents for FF-IVY, a chameleon care diary for Ivy.

Allowed task keys: ${TASK_KEYS.join(", ")}
Allowed insect keys: cricket, locust, dubia (waxworm is stock-only — never gut_load/clean)
Allowed last-done activities: ${ACTIVITIES.join(", ")}

Return ONLY JSON matching the schema. Extract intents — do not invent stock or decide due dates.

Rules:
- One utterance may contain multiple intents (e.g. feed + water).
- "fed Ivy" / "I fed her" → log_feed. Set insectKey only if the user named an insect. vague=true when insect not named.
- "topped up the water" / "checked the water" without rainmaker vs humidifier → log_task with taskKey null and vagueHint "water".
- Named rainmaker / humidifier / habitat / environment → log_task with that taskKey.
- Gut load / enclosure clean for insects → log_insect. insectKind is gut_load or clean.
- "What does Ivy need today?" → query_needs_today.
- "When was the last time X?" → query_last_done with activity (and insectKey if relevant).
- Spelling variants of Ivy/Ivvy are fine.
- Ignore unrelated chatter; return intents: [] if nothing actionable.`;

const parseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: [
              "log_feed",
              "log_task",
              "log_insect",
              "query_needs_today",
              "query_last_done",
            ],
          },
          taskKey: { type: ["string", "null"] },
          insectKey: { type: ["string", "null"] },
          insectKind: { type: ["string", "null"] },
          activity: { type: ["string", "null"] },
          vagueHint: { type: ["string", "null"] },
          vague: { type: ["boolean", "null"] },
        },
        required: [
          "kind",
          "taskKey",
          "insectKey",
          "insectKind",
          "activity",
          "vagueHint",
          "vague",
        ],
      },
    },
  },
  required: ["intents"],
} as const;

export async function parseVoiceIntents(input: {
  transcript: string;
  context: VoiceCareContext;
}): Promise<SoftIntent[]> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "voice_intents",
        strict: true,
        schema: parseSchema,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          transcript: input.transcript,
          careContext: input.context,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];

  let parsed: { intents?: LlmIntentRaw[] };
  try {
    parsed = JSON.parse(content) as { intents?: LlmIntentRaw[] };
  } catch {
    return [];
  }

  const intents: SoftIntent[] = [];
  for (const raw of parsed.intents ?? []) {
    const intent = normalizeIntent(raw);
    if (intent) intents.push(intent);
  }
  return intents;
}

const clarifySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    optionId: { type: ["string", "null"] },
  },
  required: ["optionId"],
} as const;

export async function matchClarificationWithLlm(input: {
  transcript: string;
  pending: PendingClarification;
}): Promise<string | null> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "clarify_choice",
        strict: true,
        schema: clarifySchema,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "Map the user's spoken reply to one clarification option id. Return optionId null if unclear.",
      },
      {
        role: "user",
        content: JSON.stringify({
          transcript: input.transcript,
          question: input.pending.question,
          options: input.pending.options,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { optionId?: string | null };
    const id = parsed.optionId;
    if (!id) return null;
    if (!input.pending.options.some((option) => option.id === id)) return null;
    return id;
  } catch {
    return null;
  }
}
