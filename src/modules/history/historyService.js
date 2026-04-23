function createHistoryService(options) {
  const historyRepository = options && options.historyRepository;
  const maxMessages =
    options && Number.isInteger(options.maxMessages) && options.maxMessages > 0 ? options.maxMessages : 30;

  if (!historyRepository) {
    throw new Error("History service requires historyRepository");
  }

  function applyLimit(history, limit) {
    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : maxMessages;
    if (!Array.isArray(history) || history.length <= normalizedLimit) {
      return Array.isArray(history) ? history : [];
    }

    return history.slice(-normalizedLimit);
  }

  async function getAllMessages(dialogId) {
    const history = await historyRepository.getHistory(dialogId);
    return applyLimit(history);
  }

  async function getRecentMessages(dialogId, limit) {
    const history = await historyRepository.getHistory(dialogId);
    return applyLimit(history, limit);
  }

  async function saveMessages(dialogId, messages) {
    const normalizedHistory = applyLimit(messages);
    await historyRepository.saveHistory(dialogId, normalizedHistory);
  }

  async function appendMessage(dialogId, message) {
    const history = await historyRepository.getHistory(dialogId);
    const nextHistory = [...history, message];
    await historyRepository.saveHistory(dialogId, applyLimit(nextHistory));
  }

  return {
    getAllMessages,
    getRecentMessages,
    saveMessages,
    appendMessage
  };
}

module.exports = {
  createHistoryService
};
