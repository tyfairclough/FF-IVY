export const CARE_TASKS = [
  {
    key: "habitat_clean",
    label: "Habitat clean",
    voice: ["habitat clean", "cleaned habitat", "cleaned the habitat"],
  },
  {
    key: "rainmaker_water",
    label: "Rainmaker water",
    voice: [
      "rainmaker",
      "cleaned rainmaker",
      "changed rainmaker",
      "rainmaker water",
    ],
  },
  {
    key: "humidifier_water",
    label: "Humidifier water",
    voice: [
      "humidifier",
      "changed humidifier",
      "humidifier water",
      "cleaned humidifier",
    ],
  },
  {
    key: "env_check",
    label: "Environment check",
    voice: [
      "checked temps",
      "checked temperatures",
      "environment check",
      "checked environment",
      "temps look good",
    ],
  },
] as const;

export type TaskKey = (typeof CARE_TASKS)[number]["key"];

export function isTaskKey(value: string): value is TaskKey {
  return CARE_TASKS.some((task) => task.key === value);
}

export function taskByKey(key: TaskKey) {
  return CARE_TASKS.find((task) => task.key === key)!;
}
