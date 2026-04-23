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

function createHistoryRepository(options) {
  const storageDir = options && options.storageDir ? options.storageDir : path.join(process.cwd(), "data", "history");

  function resolveHistoryPath(dialogId) {
    const safeId = String(dialogId).replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(storageDir, `${safeId}.yaml`);
  }

  async function ensureStorageDir() {
    await fs.mkdir(storageDir, { recursive: true });
  }

  async function getHistory(dialogId) {
    const filePath = resolveHistoryPath(dialogId);

    try {
      const yamlRaw = await fs.readFile(filePath, "utf8");
      const parsed = yaml.load(yamlRaw);
      return normalizeHistory(parsed);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function saveHistory(dialogId, history) {
    await ensureStorageDir();
    const filePath = resolveHistoryPath(dialogId);
    const normalizedHistory = normalizeHistory(history);
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
  createHistoryRepository
};
