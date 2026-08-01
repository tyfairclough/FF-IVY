export type VoiceCommand =
  | { type: "feed" }
  | { type: "task"; taskKey: "habitat_clean" | "rainmaker_water" | "humidifier_water" | "env_check" }
  | { type: "insect"; key: "cricket" | "locust" | "dubia"; kind: "gut_load" | "clean" };

const FEED_PHRASES = [
  "fed",
  "feed",
  "logged feeding",
  "log feeding",
  "feeding done",
  "food given",
];

const TASK_PHRASES: Array<{ taskKey: VoiceCommand & { type: "task" } extends never ? never : Extract<VoiceCommand, { type: "task" }>["taskKey"]; phrases: string[] }> = [
  {
    taskKey: "habitat_clean",
    phrases: ["habitat clean", "cleaned habitat", "cleaned the habitat", "clean habitat"],
  },
  {
    taskKey: "rainmaker_water",
    phrases: [
      "cleaned rainmaker",
      "changed rainmaker",
      "rainmaker water",
      "rain maker",
      "rainmaker",
    ],
  },
  {
    taskKey: "humidifier_water",
    phrases: [
      "changed humidifier",
      "humidifier water",
      "cleaned humidifier",
      "humidifier",
    ],
  },
  {
    taskKey: "env_check",
    phrases: [
      "checked temps",
      "checked temperatures",
      "environment check",
      "checked environment",
      "temps look good",
      "temperature check",
    ],
  },
];

const INSECT_PHRASES: Array<{
  key: "cricket" | "locust" | "dubia";
  gut: string[];
  clean: string[];
}> = [
  {
    key: "cricket",
    gut: ["gut loaded cricket", "gut loaded crickets", "gut load cricket", "gut load crickets"],
    clean: ["cleaned cricket", "cleaned crickets", "clean cricket", "clean crickets"],
  },
  {
    key: "locust",
    gut: ["gut loaded locust", "gut loaded locusts", "gut load locust", "gut load locusts"],
    clean: ["cleaned locust", "cleaned locusts", "clean locust", "clean locusts"],
  },
  {
    key: "dubia",
    gut: [
      "gut loaded dubia",
      "gut load dubia",
      "gut loaded roaches",
      "gut load roaches",
    ],
    clean: [
      "cleaned dubia",
      "clean dubia",
      "cleaned roaches",
      "clean roaches",
    ],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = normalize(transcript);
  if (!text) return null;

  for (const phrase of FEED_PHRASES) {
    if (text === phrase || text.includes(phrase)) {
      return { type: "feed" };
    }
  }

  for (const insect of INSECT_PHRASES) {
    for (const phrase of insect.gut) {
      if (text.includes(phrase)) {
        return { type: "insect", key: insect.key, kind: "gut_load" };
      }
    }
    for (const phrase of insect.clean) {
      if (text.includes(phrase)) {
        return { type: "insect", key: insect.key, kind: "clean" };
      }
    }
  }

  for (const task of TASK_PHRASES) {
    for (const phrase of task.phrases) {
      if (text.includes(phrase)) {
        return { type: "task", taskKey: task.taskKey };
      }
    }
  }

  return null;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "webkitSpeechRecognition" in window || "SpeechRecognition" in window
  );
}
