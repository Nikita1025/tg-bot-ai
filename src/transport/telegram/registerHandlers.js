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

function buildIdentifiersFromMessage(msg) {
  return {
    telegramId: msg && msg.from && typeof msg.from.id !== "undefined" ? String(msg.from.id) : null,
    sessionId: msg && msg.chat && typeof msg.chat.id !== "undefined" ? String(msg.chat.id) : null
  };
}

function buildIdentifiersFromCallback(query) {
  return {
    telegramId: query && query.from && typeof query.from.id !== "undefined" ? String(query.from.id) : null,
    sessionId:
      query && query.message && query.message.chat && typeof query.message.chat.id !== "undefined"
        ? String(query.message.chat.id)
        : null
  };
}

function registerHandlers(bot, dependencies) {
  const { conversationService, telegramSender, ollamaConfig } = dependencies;
  const callbackPrefix = "set_model:";

  async function getChatModel(identifiers) {
    return conversationService.getActiveModel(identifiers);
  }

  function formatModelTitle(model) {
    const baseName = model.split(":")[0] || model;
    return baseName.replace(/([a-zA-Z])(\d)/g, "$1 $2").replace(/[_-]/g, " ");
  }

  async function buildModelsKeyboard(identifiers) {
    const current = await getChatModel(identifiers);
    return {
      inline_keyboard: ollamaConfig.availableModels.map((model) => [
        {
          text: model === current ? `${formatModelTitle(model)} ✅` : formatModelTitle(model),
          callback_data: `${callbackPrefix}${model}`
        }
      ])
    };
  }

  async function listModelsMessage(identifiers) {
    const current = await getChatModel(identifiers);
    return `Текущая модель: ${current}\n\nВыбери модель кнопкой ниже.`;
  }

  bot.on("message", async (msg) => {
    if (!msg || typeof msg.text !== "string") {
      return;
    }

    const chatId = msg.chat.id;
    const identifiers = buildIdentifiersFromMessage(msg);
    const userText = msg.text.trim();

    if (!userText) {
      await bot.sendMessage(chatId, "Пустое сообщение не обрабатывается.");
      return;
    }

    if (isCommand(userText, "/start")) {
      const currentModel = await getChatModel(identifiers);
      await bot.sendMessage(
        chatId,
        `Бот запущен. Текущая модель: ${currentModel}\n\nКоманды:\n/start - помощь\n/models - выбор модели кнопками`
      );
      return;
    }

    if (isCommand(userText, "/models")) {
      await bot.sendMessage(chatId, await listModelsMessage(identifiers), {
        reply_markup: await buildModelsKeyboard(identifiers)
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
        await bot.sendMessage(chatId, `Неизвестная модель: ${requestedModel}\n\n${await listModelsMessage(identifiers)}`);
        return;
      }

      await conversationService.setActiveModel(identifiers, requestedModel);
      await bot.sendMessage(chatId, `Модель переключена: ${requestedModel}`);
      return;
    }

    try {
      await bot.sendChatAction(chatId, "typing");
      const { replyText } = await conversationService.handleIncomingMessage({
        identifiers,
        text: userText
      });

      await telegramSender.sendLongMessage(chatId, replyText);
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
      const identifiers = buildIdentifiersFromCallback(query);
      const requestedModel = data.slice(callbackPrefix.length);

      if (!ollamaConfig.availableModels.includes(requestedModel)) {
        await bot.answerCallbackQuery(query.id, {
          text: "Модель недоступна.",
          show_alert: true
        });
        return;
      }

      const currentModel = await getChatModel(identifiers);
      if (currentModel === requestedModel) {
        await bot.answerCallbackQuery(query.id, {
          text: `Модель уже выбрана: ${formatModelTitle(requestedModel)}`
        });
        return;
      }

      await conversationService.setActiveModel(identifiers, requestedModel);

      await bot.answerCallbackQuery(query.id, {
        text: `Выбрана модель: ${formatModelTitle(requestedModel)}`
      });

      try {
        await bot.editMessageText(await listModelsMessage(identifiers), {
          chat_id: chatId,
          message_id: message.message_id,
          reply_markup: await buildModelsKeyboard(identifiers)
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
