const CONTEXT_FIRST_SYSTEM_PROMPT = [
  "Ты помощник внутри пользовательского диалога.",
  "Фразы пользователя вроде \"мои ограничения\", \"мои условия\", \"мои требования\" относятся к ограничениям текущей задачи и фактам из истории чата.",
  "Не подменяй ответ перечислением ограничений модели или политик, если пользователь явно не спрашивает про них.",
  "Если данных в истории не хватает, прямо скажи это и задай короткий уточняющий вопрос."
].join(" ");

const SUMMARY_ROLE = "system";
const SUMMARY_PREFIX = "Краткое резюме предыдущего диалога:\n";

function buildSystemPrompt(value) {
  const customPrompt = typeof value === "string" ? value.trim() : "";
  return customPrompt ? `${CONTEXT_FIRST_SYSTEM_PROMPT}\n\n${customPrompt}` : CONTEXT_FIRST_SYSTEM_PROMPT;
}

function isContextRecallQuestion(text) {
  if (typeof text !== "string") {
    return false;
  }

  const normalized = text.toLowerCase();
  const markers = [
    "напомни мои ограничения",
    "напомни ограничения",
    "какие ограничения",
    "что я просил",
    "что я просила",
    "из контекста",
    "в нашем диалоге",
    "в переписке",
    "по истории",
    "из истории",
    "что было выше"
  ];

  return markers.some((marker) => normalized.includes(marker));
}

function looksLikeModelPolicyRefusal(text) {
  if (typeof text !== "string") {
    return false;
  }

  const normalized = text.toLowerCase();
  const markers = [
    "не могу видеть",
    "не имею доступа",
    "не вижу предыдущ",
    "не храню историю",
    "не могу получить доступ",
    "ограничения модели",
    "как модель",
    "я не могу просматривать"
  ];

  return markers.some((marker) => normalized.includes(marker));
}

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

function createChatService(options) {
  const llmClient = options && options.llmClient;
  const systemPromptTemplate = options && options.systemPrompt ? options.systemPrompt : "";

  if (!llmClient) {
    throw new Error("Chat service requires llmClient");
  }

  async function generateReply({ model, history, userText }) {
    const systemPrompt = buildSystemPrompt(systemPromptTemplate);
    const userMessage = { role: "user", content: userText };
    const safeHistory = Array.isArray(history) ? history : [];
    const modelMessages = [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...safeHistory, userMessage];

    let llmReply = await llmClient.query(modelMessages, model);

    if (isContextRecallQuestion(userText) && looksLikeModelPolicyRefusal(llmReply)) {
      const retryMessages = [
        {
          role: "system",
          content:
            "Исправь предыдущий ответ. Ответь строго по истории текущего диалога и перечисли именно пользовательские ограничения задачи. Не перечисляй ограничения модели."
        },
        ...modelMessages
      ];
      llmReply = await llmClient.query(retryMessages, model);
    }

    return {
      replyText: llmReply,
      userMessage,
      assistantMessage: { role: "assistant", content: llmReply }
    };
  }

  async function summarizeHistoryChunk(historyChunk, model) {
    if (!Array.isArray(historyChunk) || historyChunk.length === 0) {
      return null;
    }

    const summaryPromptMessages = buildSummaryRequestMessages(historyChunk);
    const summaryText = await llmClient.query(summaryPromptMessages, model);
    const normalizedSummary = typeof summaryText === "string" ? summaryText.trim() : "";

    if (!normalizedSummary) {
      return null;
    }

    return {
      role: SUMMARY_ROLE,
      content: `${SUMMARY_PREFIX}${normalizedSummary}`
    };
  }

  return {
    generateReply,
    summarizeHistoryChunk
  };
}

module.exports = {
  createChatService
};
