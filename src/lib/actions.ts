"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import {
  logFeed,
  logInsect,
  logTask,
  setInsectStock,
  undoFeed,
  undoInsectLog,
  undoTask,
} from "@/lib/queries";
import { isTaskKey } from "@/lib/tasks";
import type { InsectKey, InsectLogKind } from "@/lib/db";

async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function completeFeedAction() {
  await requireAuth();
  const log = await logFeed();
  revalidatePath("/");
  revalidatePath("/calendar");
  return {
    ok: true as const,
    message: `Logged feed #${log.cycle_index} (${log.supplement})`,
    undo: { type: "feed" as const, id: log.id },
  };
}

export async function completeTaskAction(taskKey: string) {
  await requireAuth();
  if (!isTaskKey(taskKey)) {
    throw new Error("Unknown task");
  }
  const log = await logTask(taskKey);
  revalidatePath("/");
  return {
    ok: true as const,
    message: `Logged ${taskKey.replaceAll("_", " ")}`,
    undo: { type: "task" as const, id: log.id },
  };
}

export async function setInsectStockAction(key: InsectKey, inStock: boolean) {
  await requireAuth();
  const insect = await setInsectStock(key, inStock);
  revalidatePath("/");
  revalidatePath("/insects");
  return {
    ok: true as const,
    message: `${insect.label} ${inStock ? "checked in" : "checked out"}`,
  };
}

export async function logInsectAction(key: InsectKey, kind: InsectLogKind) {
  await requireAuth();
  const log = await logInsect(key, kind);
  revalidatePath("/");
  revalidatePath("/insects");
  const label = kind === "gut_load" ? "gut load" : "clean";
  return {
    ok: true as const,
    message: `Logged ${label} for ${key}`,
    undo: { type: "insect" as const, id: log.id },
  };
}

export async function undoAction(type: "feed" | "task" | "insect", id: number) {
  await requireAuth();
  if (type === "feed") {
    await undoFeed(id);
    revalidatePath("/");
    revalidatePath("/calendar");
  } else if (type === "task") {
    await undoTask(id);
    revalidatePath("/");
  } else {
    await undoInsectLog(id);
    revalidatePath("/");
    revalidatePath("/insects");
  }
  return { ok: true as const, message: "Undone" };
}
