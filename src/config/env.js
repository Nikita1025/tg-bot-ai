require("dotenv").config();

function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readOptionalNumberEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readModelsEnv(name, fallbackList) {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return fallbackList;
  }

  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length ? parsed : fallbackList;
}

function loadConfig() {
  const availableModels = readModelsEnv("OLLAMA_AVAILABLE_MODELS", ["gemma3:270m", "qwen3.5:0.8b"]);
  const defaultModel = process.env.OLLAMA_MODEL || availableModels[0];

  const config = {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN,
      pollingIntervalMs: readNumberEnv("TELEGRAM_POLLING_INTERVAL_MS", 300),
      pollingTimeoutSec: readNumberEnv("TELEGRAM_POLLING_TIMEOUT_SEC", 10),
      maxMessageLength: readNumberEnv("TELEGRAM_MAX_MESSAGE_LENGTH", 4000)
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      defaultModel,
      availableModels,
      timeoutMs: readNumberEnv("LLM_TIMEOUT_MS", 45_000),
      numPredict: readOptionalNumberEnv("OLLAMA_NUM_PREDICT")
    }
  };

  if (!config.telegram.token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN in environment.");
  }

  return config;
}

module.exports = {
  loadConfig
};
