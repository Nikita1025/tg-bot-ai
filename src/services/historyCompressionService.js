const SUMMARY_ROLE = "system";
const SUMMARY_PREFIX = "Краткое резюме предыдущего диалога:\n";

function formatHistoryForSummary(historyChunk) {
  return historyChunk
    .map((message) => {
      const roleLabel = message.role === "assistant" ? "Ассистент" : message.role === "system" ? "Система" : "Пользователь";
      return `${roleLabel}: ${message.content}`;
    })
    .join("\n");
}

function buildSummaryRequestMessages(historyChunk) {
  const formattedHistory = formatHistoryForSummary(historyChunk);
  return [
    {
      role: "system",
      content:
        "Ты сжимаешь контекст диалога для Telegram-бота. Верни резюме на русском языке в формате 3 коротких строк: " +
        "\"Цель: ...\", \"Ограничения и предпочтения пользователя: ...\", \"Текущий статус/договоренности: ...\". " +
        "Если данных для строки нет, напиши \"нет данных\"."
    },
    {
      role: "user",
      content: `Сожми диалог, сохранив ключевые факты, цели пользователя и договоренности:\n\n${formattedHistory}`
    }
  ];
}

function createHistoryCompressionService(options) {
  const ollamaService = options && options.ollamaService;
  const summaryThreshold =
    options && Number.isInteger(options.summaryThreshold) && options.summaryThreshold > 0 ? options.summaryThreshold : 5;
  const keepRecentMessages =
    options && Number.isInteger(options.keepRecentMessages) && options.keepRecentMessages > 1
      ? options.keepRecentMessages
      : 6;

  async function compressIfNeeded(chatId, history, modelOverride) {
    if (!ollamaService || !Array.isArray(history) || history.length <= summaryThreshold) {
      return history;
    }

    const splitIndex = history.length - keepRecentMessages;
    if (splitIndex <= 0) {
      return history;
    }

    const historyChunk = history.slice(0, splitIndex);
    const recentMessages = history.slice(splitIndex);
    const summaryPromptMessages = buildSummaryRequestMessages(historyChunk);

    try {
      const summaryText = await ollamaService.query(summaryPromptMessages, modelOverride);
      const normalizedSummary = typeof summaryText === "string" ? summaryText.trim() : "";

      if (!normalizedSummary) {
        return history;
      }

      return [{ role: SUMMARY_ROLE, content: `${SUMMARY_PREFIX}${normalizedSummary}` }, ...recentMessages];
    } catch (error) {
      console.error(`Failed to summarize history for chat ${chatId}:`, error.message || error);
      return history;
    }
  }

  return {
    compressIfNeeded
  };
}

module.exports = {
  createHistoryCompressionService
};
