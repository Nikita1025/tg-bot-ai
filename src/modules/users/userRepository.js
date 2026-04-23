const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const yaml = require("js-yaml");

function normalizeUser(rawUser) {
  if (!rawUser || typeof rawUser !== "object") {
    return null;
  }

  const id = typeof rawUser.id === "string" && rawUser.id.trim() ? rawUser.id : crypto.randomUUID();
  const telegramId =
    rawUser.telegramId === null || rawUser.telegramId === undefined ? null : String(rawUser.telegramId);
  const sessionId =
    rawUser.sessionId === null || rawUser.sessionId === undefined ? null : String(rawUser.sessionId);
  const preferredModel =
    typeof rawUser.preferredModel === "string" && rawUser.preferredModel.trim() ? rawUser.preferredModel : null;

  if (!telegramId && !sessionId) {
    return null;
  }

  return {
    id,
    telegramId,
    sessionId,
    preferredModel
  };
}

function createUserRepository(options) {
  const storageFile =
    options && options.storageFile ? options.storageFile : path.join(process.cwd(), "data", "users", "users.yaml");

  async function ensureStorageDir() {
    await fs.mkdir(path.dirname(storageFile), { recursive: true });
  }

  async function readUsers() {
    try {
      const content = await fs.readFile(storageFile, "utf8");
      const parsed = yaml.load(content);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(normalizeUser).filter(Boolean);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async function writeUsers(users) {
    await ensureStorageDir();
    const yamlContent = yaml.dump(users, { lineWidth: -1, noRefs: true });
    await fs.writeFile(storageFile, yamlContent, "utf8");
  }

  async function findByIdentifiers(identifiers) {
    const telegramId = identifiers && identifiers.telegramId ? String(identifiers.telegramId) : null;
    const sessionId = identifiers && identifiers.sessionId ? String(identifiers.sessionId) : null;
    if (!telegramId && !sessionId) {
      return null;
    }

    const users = await readUsers();
    return (
      users.find(
        (user) =>
          (telegramId && user.telegramId === telegramId) || (sessionId && user.sessionId && user.sessionId === sessionId)
      ) || null
    );
  }

  async function upsertByIdentifiers(identifiers, patch) {
    const telegramId = identifiers && identifiers.telegramId ? String(identifiers.telegramId) : null;
    const sessionId = identifiers && identifiers.sessionId ? String(identifiers.sessionId) : null;
    if (!telegramId && !sessionId) {
      throw new Error("At least one identifier (telegramId/sessionId) is required");
    }

    const users = await readUsers();
    const existingIndex = users.findIndex(
      (user) =>
        (telegramId && user.telegramId === telegramId) || (sessionId && user.sessionId && user.sessionId === sessionId)
    );

    const existing = existingIndex >= 0 ? users[existingIndex] : null;
    const merged = normalizeUser({
      id: existing ? existing.id : crypto.randomUUID(),
      telegramId: telegramId || (existing ? existing.telegramId : null),
      sessionId: sessionId || (existing ? existing.sessionId : null),
      preferredModel:
        patch && typeof patch.preferredModel !== "undefined"
          ? patch.preferredModel
          : existing
            ? existing.preferredModel
            : null
    });

    if (existingIndex >= 0) {
      users.splice(existingIndex, 1, merged);
    } else {
      users.push(merged);
    }

    await writeUsers(users);
    return merged;
  }

  return {
    findByIdentifiers,
    upsertByIdentifiers
  };
}

module.exports = {
  createUserRepository
};
