import { neon } from "@neondatabase/serverless";

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

export type InsectKey = "cricket" | "locust" | "dubia" | "waxworm";
export type InsectLogKind = "gut_load" | "clean";

export type InsectRow = {
  key: InsectKey;
  label: string;
  in_stock: boolean;
  checked_in_at: string | null;
  tracks_husbandry: boolean;
  last_gut_load: string | null;
  last_clean: string | null;
};

export type TaskLatest = {
  task_key: string;
  completed_at: string | null;
};
