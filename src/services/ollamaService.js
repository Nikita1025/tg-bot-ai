function stringifyMessagesForLogging(messages) {
  return JSON.stringify(messages, null, 2);
}

function stringifyMessagesForTokenization(messages) {
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
}

function estimateTokenCountFallback(messages) {
  const contentText = stringifyMessagesForTokenization(messages);
  return Math.ceil(contentText.length / 4);
}

async function calculateContextTokenCount(ollamaConfig, model, messages, signal) {
  try {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tokenize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt: stringifyMessagesForTokenization(messages)
      }),
      signal
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data.tokens)) {
      return data.tokens.length;
    }

    if (Number.isInteger(data.token_count)) {
      return data.token_count;
    }

    return null;
  } catch (_) {
    return null;
  }
}

function createOllamaService(ollamaConfig) {
  async function query(messages, modelOverride) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages history is required");
    }

    const selectedModel = modelOverride || ollamaConfig.defaultModel;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ollamaConfig.timeoutMs);

    try {
      const exactTokenCount = await calculateContextTokenCount(ollamaConfig, selectedModel, messages, controller.signal);
      const contextTokenCount = Number.isInteger(exactTokenCount) ? exactTokenCount : estimateTokenCountFallback(messages);

      console.log("[LLM] Request model:", selectedModel);
      console.log("[LLM] Request context (messages):", stringifyMessagesForLogging(messages));
      console.log(
        "[LLM] Request context token count:",
        contextTokenCount,
        Number.isInteger(exactTokenCount) ? "(exact via /api/tokenize)" : "(estimated fallback)"
      );

      const payload = {
        model: selectedModel,
        messages,
        stream: false
      };

      if (typeof ollamaConfig.numPredict === "number") {
        payload.options = { num_predict: ollamaConfig.numPredict };
      }

      const response = await fetch(`${ollamaConfig.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`LLM HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data && data.message && typeof data.message.content === "string" ? data.message.content.trim() : "";

      if (!text) {
        throw new Error("LLM returned empty response");
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    query
  };
}

module.exports = {
  createOllamaService
};
