const fs = require("node:fs");
const path = require("node:path");

const SYSTEM_PROMPTS_PATH = path.resolve(__dirname, "../../../system.md");

function loadSystemPrompts() {
  const rawContent = fs.readFileSync(SYSTEM_PROMPTS_PATH, "utf8");
  const normalizedContent = typeof rawContent === "string" ? rawContent.trim() : "";

  if (!normalizedContent) {
    throw new Error("system.md is empty");
  }

  try {
    const parsed = JSON.parse(normalizedContent);

    if (typeof parsed === "string" && parsed.trim()) {
      return { contextFirstSystemPrompt: parsed.trim() };
    }

    if (parsed && typeof parsed.contextFirstSystemPrompt === "string" && parsed.contextFirstSystemPrompt.trim()) {
      return { contextFirstSystemPrompt: parsed.contextFirstSystemPrompt.trim() };
    }

    throw new Error("system.md JSON must contain contextFirstSystemPrompt");
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { contextFirstSystemPrompt: normalizedContent };
    }

    throw error;
  }
}
const SYSTEM_PROMPTS = loadSystemPrompts();
const INJECTION_RESPONSE = "Не могу выполнить этот запрос. Я не раскрываю внутренние инструкции и не отключаю правила безопасности. Сформулируй обычный пользовательский запрос, и я помогу.";
const SAFE_EMPTY_INPUT_RESPONSE = "Похоже, сообщение пустое. Напиши вопрос или задачу обычным текстом.";
const HOW_ARE_YOU_ERROR_RESPONSE = "Ошибка: этот тип вопроса запрещен политикой чата.";
const ALLOWED_HISTORY_ROLES = new Set(["user", "assistant"]);
const HOW_ARE_YOU_PATTERN = /^\s*как\s+дела\s*[?!.,…]*\s*$/iu;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCanaryTokens(systemPrompt) {
  if (!systemPrompt) {
    return [];
  }

  const tokenPattern = /\b[A-Z0-9]{4,}(?:_[A-Z0-9]{2,})+\b/g;
  return Array.from(new Set(systemPrompt.match(tokenPattern) || []));
}

function looksLikePromptInjection(text) {
  const normalizedText = typeof text === "string" ? text.toLowerCase() : "";

  if (!normalizedText) {
    return false;
  }

  const directPatterns = [
    /ignore\s+all\s+previous\s+instructions/,
    /игнорируй\s+вс[её]\s+предыдущ[иех]+\s+инструкц/,
    /repeat\s+(your|the)\s+(hidden|system|developer)\s+instructions/,
    /повтори\s+(свои|скрытые|системные)\s+инструкц/,
    /выведи\s+.*(system|системн).*(prompt|промпт)/,
    /режим\s+снят/,
    /mode\s+unlocked/,
    /ты\s+теперь\s+.*без\s+ограничений/,
    /с\s+этого\s+момента\s+ты\s+должен/,
    /раскрой\s+.*(system|developer|скрыт|внутрен)/,
    /покажи\s+.*(system|developer|систем|скрыт).*(prompt|промпт|инструкц)/
  ];

  return directPatterns.some((pattern) => pattern.test(normalizedText));
}

function leakedSensitiveContent(replyText, canaryTokens) {
  const normalizedReply = typeof replyText === "string" ? replyText.toLowerCase() : "";

  if (!normalizedReply) {
    return false;
  }

  const disclosurePatterns = [
    /system\s*prompt/,
    /developer\s*prompt/,
    /hidden\s+instructions/,
    /системн(ый|ого|ому)\s+промпт/,
    /скрыт(ые|ых|ым)\s+инструкц/,
    /иерархия\s+инструкц/
  ];

  if (disclosurePatterns.some((pattern) => pattern.test(normalizedReply))) {
    return true;
  }

  return canaryTokens.some((token) => {
    const tokenPattern = new RegExp(`\\b${escapeRegExp(token.toLowerCase())}\\b`);
    return tokenPattern.test(normalizedReply);
  });
}

function sanitizeUserInput(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .trim();
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((message) => message && ALLOWED_HISTORY_ROLES.has(message.role))
    .map((message) => ({
      role: message.role,
      content: sanitizeUserInput(message.content)
    }))
    .filter((message) => message.content.length > 0);
}

function isDisallowedHowAreYouQuestion(text) {
  if (typeof text !== "string") {
    return false;
  }

  return HOW_ARE_YOU_PATTERN.test(text);
}

function buildSystemPrompt(value) {
  const customPrompt = typeof value === "string" ? value.trim() : "";
  return customPrompt
    ? `${SYSTEM_PROMPTS.contextFirstSystemPrompt}\n\n${customPrompt}`
    : SYSTEM_PROMPTS.contextFirstSystemPrompt;
}

function createChatService(options) {
  const llmClient = options && options.llmClient;
  const systemPromptTemplate = options && options.systemPrompt ? options.systemPrompt : "";
  const canaryTokens = extractCanaryTokens(SYSTEM_PROMPTS.contextFirstSystemPrompt);

  if (!llmClient) {
    throw new Error("Chat service requires llmClient");
  }

  async function generateReply({ model, history, userText }) {
    const sanitizedUserText = sanitizeUserInput(userText);

    if (!sanitizedUserText) {
      return {
        replyText: SAFE_EMPTY_INPUT_RESPONSE,
        userMessage: { role: "user", content: "" },
        assistantMessage: { role: "assistant", content: SAFE_EMPTY_INPUT_RESPONSE }
      };
    }

    if (isDisallowedHowAreYouQuestion(sanitizedUserText)) {
      return {
        replyText: HOW_ARE_YOU_ERROR_RESPONSE,
        userMessage: { role: "user", content: sanitizedUserText },
        assistantMessage: { role: "assistant", content: HOW_ARE_YOU_ERROR_RESPONSE }
      };
    }

    if (looksLikePromptInjection(sanitizedUserText)) {
      return {
        replyText: INJECTION_RESPONSE,
        userMessage: { role: "user", content: sanitizedUserText },
        assistantMessage: { role: "assistant", content: INJECTION_RESPONSE }
      };
    }

    const systemPrompt = buildSystemPrompt(systemPromptTemplate);
    const userMessage = { role: "user", content: sanitizedUserText };
    const safeHistory = sanitizeHistory(history);
    const modelMessages = [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...safeHistory, userMessage];

    const llmReply = await llmClient.query(modelMessages, model);
    const safeReply = leakedSensitiveContent(llmReply, canaryTokens) ? INJECTION_RESPONSE : llmReply;

    return {
      replyText: safeReply,
      userMessage,
      assistantMessage: { role: "assistant", content: safeReply }
    };
  }

  return {
    generateReply,
  };
}

module.exports = {
  createChatService
};
