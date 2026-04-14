function isCommand(text, command) {
  return text === command || text.startsWith(`${command} `) || text.startsWith(`${command}@`);
}

function isMessageNotModifiedError(error) {
  if (!error) {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";
  const description =
    error.response &&
    error.response.body &&
    typeof error.response.body.description === "string"
      ? error.response.body.description
      : "";

  return message.includes("message is not modified") || description.includes("message is not modified");
}

const CONTEXT_FIRST_SYSTEM_PROMPT = [
  "Ты помощник внутри пользовательского диалога.",
  "Фразы пользователя вроде \"мои ограничения\", \"мои условия\", \"мои требования\" относятся к ограничениям текущей задачи и фактам из истории чата.",
  "Не подменяй ответ перечислением ограничений модели или политик, если пользователь явно не спрашивает про них.",
  "Если данных в истории не хватает, прямо скажи это и задай короткий уточняющий вопрос."
].join(" ");

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

function registerHandlers(bot, dependencies) {
  const { ollamaService, telegramSender, ollamaConfig, dialogHistoryService, historyCompressionService } = dependencies;
  const contextEnabled = dependencies.contextEnabled !== false;
  const compressionService = historyCompressionService || { compressIfNeeded: async (_, history) => history };
  const selectedModelByChat = new Map();
  const callbackPrefix = "set_model:";

  function getChatModel(chatId) {
    return selectedModelByChat.get(chatId) || ollamaConfig.defaultModel;
  }

  function formatModelTitle(model) {
    const baseName = model.split(":")[0] || model;
    return baseName.replace(/([a-zA-Z])(\d)/g, "$1 $2").replace(/[_-]/g, " ");
  }

  function buildModelsKeyboard(chatId) {
    const current = getChatModel(chatId);
    return {
      inline_keyboard: ollamaConfig.availableModels.map((model) => [
        {
          text: model === current ? `${formatModelTitle(model)} ✅` : formatModelTitle(model),
          callback_data: `${callbackPrefix}${model}`
        }
      ])
    };
  }

  function listModelsMessage(chatId) {
    const current = getChatModel(chatId);
    return `Текущая модель: ${current}\n\nВыбери модель кнопкой ниже.`;
  }

  bot.on("message", async (msg) => {
    if (!msg || typeof msg.text !== "string") {
      return;
    }

    const chatId = msg.chat.id;
    const userText = msg.text.trim();

    if (!userText) {
      await bot.sendMessage(chatId, "Пустое сообщение не обрабатывается.");
      return;
    }

    if (isCommand(userText, "/start")) {
      await bot.sendMessage(
        chatId,
        `Бот запущен. Текущая модель: ${getChatModel(chatId)}\n\nКоманды:\n/start - помощь\n/models - выбор модели кнопками`
      );
      return;
    }

    if (isCommand(userText, "/models")) {
      await bot.sendMessage(chatId, listModelsMessage(chatId), {
        reply_markup: buildModelsKeyboard(chatId)
      });
      return;
    }

    if (isCommand(userText, "/model")) {
      const parts = userText.split(/\s+/);
      const requestedModel = parts[1];

      if (!requestedModel) {
        await bot.sendMessage(chatId, `Укажи модель после команды.\nПример: /model ${ollamaConfig.availableModels[0]}`);
        return;
      }

      if (!ollamaConfig.availableModels.includes(requestedModel)) {
        await bot.sendMessage(
          chatId,
          `Неизвестная модель: ${requestedModel}\n\n${listModelsMessage(chatId)}`
        );
        return;
      }

      selectedModelByChat.set(chatId, requestedModel);
      await bot.sendMessage(chatId, `Модель переключена: ${requestedModel}`);
      return;
    }

    try {
      const history = contextEnabled ? await dialogHistoryService.getHistory(chatId) : [];
      const systemPrompt = buildSystemPrompt(ollamaConfig.systemPrompt);
      const historyWithUserMessage = contextEnabled ? [...history, { role: "user", content: userText }] : [];
      const liveMessages = contextEnabled
        ? historyWithUserMessage
        : [{ role: "user", content: userText }];
      const modelMessages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...liveMessages
      ];

      await bot.sendChatAction(chatId, "typing");
      const activeModel = getChatModel(chatId);
      let llmReply = await ollamaService.query(modelMessages, activeModel);

      if (contextEnabled && isContextRecallQuestion(userText) && looksLikeModelPolicyRefusal(llmReply)) {
        const retryMessages = [
          {
            role: "system",
            content:
              "Исправь предыдущий ответ. Ответь строго по истории текущего диалога и перечисли именно пользовательские ограничения задачи. Не перечисляй ограничения модели."
          },
          ...modelMessages
        ];
        llmReply = await ollamaService.query(retryMessages, activeModel);
      }

      await telegramSender.sendLongMessage(chatId, llmReply);
      if (contextEnabled) {
        const nextHistory = [...historyWithUserMessage, { role: "assistant", content: llmReply }];
        const compactHistory = await compressionService.compressIfNeeded(chatId, nextHistory, activeModel);
        await dialogHistoryService.saveHistory(chatId, compactHistory);
      }
    } catch (error) {
      console.error("Request handling error:", error);

      if (error && error.name === "AbortError") {
        await bot.sendMessage(
          chatId,
          "Модель отвечает слишком долго. Попробуй сократить запрос или повторить позже."
        );
        return;
      }

      await bot.sendMessage(
        chatId,
        "Сервис временно недоступен. Проверь, что локальная LLM запущена, и попробуй еще раз."
      );
    }
  });

  bot.on("callback_query", async (query) => {
    try {
      const data = query && query.data;
      const message = query && query.message;
      if (!data || !message || !data.startsWith(callbackPrefix)) {
        return;
      }

      const chatId = message.chat.id;
      const requestedModel = data.slice(callbackPrefix.length);

      if (!ollamaConfig.availableModels.includes(requestedModel)) {
        await bot.answerCallbackQuery(query.id, {
          text: "Модель недоступна.",
          show_alert: true
        });
        return;
      }

      if (getChatModel(chatId) === requestedModel) {
        await bot.answerCallbackQuery(query.id, {
          text: `Модель уже выбрана: ${formatModelTitle(requestedModel)}`
        });
        return;
      }

      selectedModelByChat.set(chatId, requestedModel);

      await bot.answerCallbackQuery(query.id, {
        text: `Выбрана модель: ${formatModelTitle(requestedModel)}`
      });

      try {
        await bot.editMessageText(listModelsMessage(chatId), {
          chat_id: chatId,
          message_id: message.message_id,
          reply_markup: buildModelsKeyboard(chatId)
        });
      } catch (error) {
        if (!isMessageNotModifiedError(error)) {
          throw error;
        }
      }
    } catch (error) {
      console.error("Callback handling error:", error);
      if (query && query.id) {
        await bot.answerCallbackQuery(query.id, {
          text: "Не удалось переключить модель.",
          show_alert: true
        });
      }
    }
  });

  bot.on("polling_error", (error) => {
    console.error("Polling error:", error.message || error);
  });
}

module.exports = {
  registerHandlers
};
