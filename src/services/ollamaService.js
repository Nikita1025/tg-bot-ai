function createOllamaService(ollamaConfig) {
  async function query(prompt, modelOverride) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ollamaConfig.timeoutMs);

    try {
      const payload = {
        model: modelOverride || ollamaConfig.defaultModel,
        prompt,
        stream: false
      };

      if (typeof ollamaConfig.numPredict === "number") {
        payload.options = { num_predict: ollamaConfig.numPredict };
      }

      const response = await fetch(`${ollamaConfig.baseUrl}/api/generate`, {
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
      const text = typeof data.response === "string" ? data.response.trim() : "";

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
