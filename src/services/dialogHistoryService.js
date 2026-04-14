const fs = require("node:fs/promises");
const path = require("node:path");
const yaml = require("js-yaml");

const VALID_ROLES = new Set(["user", "assistant", "system"]);

function normalizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory
    .filter((entry) => entry && VALID_ROLES.has(entry.role) && typeof entry.content === "string")
    .map((entry) => ({
      role: entry.role,
      content: entry.content
    }));
}

function createDialogHistoryService(options) {
  const storageDir = options && options.storageDir ? options.storageDir : path.join(process.cwd(), "data", "history");
  const maxMessages =
    options && Number.isInteger(options.maxMessages) && options.maxMessages > 0 ? options.maxMessages : 10;

  function applyHistoryLimit(history) {
    if (history.length <= maxMessages) {
      return history;
    }

    const latestSystemIndex = [...history].map((entry) => entry.role).lastIndexOf("system");
    if (latestSystemIndex === -1 || maxMessages === 1) {
      return history.slice(-maxMessages);
    }

    const preservedSystemMessage = history[latestSystemIndex];
    const historyWithoutPreservedSystem = history.filter((_, index) => index !== latestSystemIndex);
    const tailMessages = historyWithoutPreservedSystem.slice(-(maxMessages - 1));

    return [preservedSystemMessage, ...tailMessages];
  }

  function resolveHistoryPath(chatId) {
    const safeId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(storageDir, `${safeId}.yaml`);
  }

  async function ensureStorageDir() {
    await fs.mkdir(storageDir, { recursive: true });
  }

  async function getHistory(chatId) {
    const filePath = resolveHistoryPath(chatId);

    try {
      const yamlRaw = await fs.readFile(filePath, "utf8");
      const parsed = yaml.load(yamlRaw);
      return applyHistoryLimit(normalizeHistory(parsed));
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function saveHistory(chatId, history) {
    await ensureStorageDir();
    const filePath = resolveHistoryPath(chatId);
    const normalizedHistory = applyHistoryLimit(normalizeHistory(history));
    const yamlContent = yaml.dump(normalizedHistory, {
      lineWidth: -1,
      noRefs: true
    });
    await fs.writeFile(filePath, yamlContent, "utf8");
  }

  return {
    getHistory,
    saveHistory
  };
}

module.exports = {
  createDialogHistoryService
};
