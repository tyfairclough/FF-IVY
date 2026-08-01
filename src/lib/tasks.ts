export const CARE_TASKS = [
  {
    key: "habitat_clean",
    label: "Habitat clean",
  },
  {
    key: "rainmaker_water",
    label: "Rainmaker water",
  },
  {
    key: "humidifier_water",
    label: "Humidifier water",
  },
  {
    key: "env_check",
    label: "Environment check",
  },
] as const;

export type TaskKey = (typeof CARE_TASKS)[number]["key"];

export function isTaskKey(value: string): value is TaskKey {
  return CARE_TASKS.some((task) => task.key === value);
}

export function taskByKey(key: TaskKey) {
  return CARE_TASKS.find((task) => task.key === key)!;
}
