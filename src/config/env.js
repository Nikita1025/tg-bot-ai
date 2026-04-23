require("dotenv").config();

function loadConfig() {
  const availableModelsRaw = process.env.OLLAMA_AVAILABLE_MODELS || "";
  const availableModels = availableModelsRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const defaultModel = process.env.OLLAMA_MODEL || availableModels[0];

  const config = {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN,
      pollingIntervalMs: process.env.TELEGRAM_POLLING_INTERVAL_MS,
      pollingTimeoutSec: process.env.TELEGRAM_POLLING_TIMEOUT_SEC,
      maxMessageLength: process.env.TELEGRAM_MAX_MESSAGE_LENGTH
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL,
      defaultModel,
      availableModels,
      systemPrompt: process.env.OLLAMA_SYSTEM_PROMPT,
      timeoutMs: process.env.LLM_TIMEOUT_MS,
      numPredict: process.env.OLLAMA_NUM_PREDICT
    },
    storage: {
      contextEnabled: process.env.DIALOG_CONTEXT_ENABLED,
      dialogHistoryDir: process.env.DIALOG_HISTORY_DIR,
      usersStorageFile: process.env.USERS_STORAGE_FILE,
      dialogHistoryMaxMessages: process.env.DIALOG_HISTORY_MAX_MESSAGES,
      dialogSummaryThreshold: process.env.DIALOG_SUMMARY_THRESHOLD,
      dialogSummaryKeepRecentMessages: process.env.DIALOG_SUMMARY_KEEP_RECENT_MESSAGES
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
