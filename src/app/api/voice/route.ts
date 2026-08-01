import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { getInsects, getNextFeed, getTaskStatuses } from "@/lib/queries";
import { handleVoiceTurn } from "@/lib/voice-resolve";
import {
  buildVoiceCareContext,
  type PendingClarification,
  type VoiceApiResponse,
} from "@/lib/voice-types";

export const dynamic = "force-dynamic";

function isPendingClarification(value: unknown): value is PendingClarification {
  if (!value || typeof value !== "object") return false;
  const pending = value as PendingClarification;
  if (typeof pending.question !== "string") return false;
  if (!Array.isArray(pending.options)) return false;
  if (!pending.resolveAs || typeof pending.resolveAs !== "object") return false;
  return true;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    transcript?: unknown;
    pendingClarification?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const pendingClarification = isPendingClarification(body.pendingClarification)
    ? body.pendingClarification
    : null;

  try {
    const [nextFeed, tasks, insects] = await Promise.all([
      getNextFeed(),
      getTaskStatuses(),
      getInsects(),
    ]);

    const context = buildVoiceCareContext({
      fedToday: nextFeed.fedToday,
      nextCycleIndex: nextFeed.cycle_index,
      nextSupplement: nextFeed.supplement,
      lastFeedAt: nextFeed.last?.fed_at ?? null,
      tasks,
      insects,
    });

    const response: VoiceApiResponse = await handleVoiceTurn({
      transcript,
      pendingClarification,
      context,
      insects,
    });

    if (
      response.type === "execute" ||
      (response.type === "clarify" && response.results.length > 0) ||
      (response.type === "error" && (response.results?.length ?? 0) > 0)
    ) {
      revalidatePath("/");
      revalidatePath("/calendar");
      revalidatePath("/insects");
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice request failed";
    return NextResponse.json(
      {
        type: "error",
        spoken: message,
        message,
      } satisfies VoiceApiResponse,
      { status: 500 },
    );
  }
}
