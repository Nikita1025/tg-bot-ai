function isCommand(text, command) {
  return text === command || text.startsWith(`${command} `) || text.startsWith(`${command}@`);
}

function registerHandlers(bot, dependencies) {
  const { ollamaService, telegramSender, ollamaConfig } = dependencies;
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
      await bot.sendChatAction(chatId, "typing");
      const llmReply = await ollamaService.query(userText, getChatModel(chatId));
      await telegramSender.sendLongMessage(chatId, llmReply);
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

      selectedModelByChat.set(chatId, requestedModel);

      await bot.answerCallbackQuery(query.id, {
        text: `Выбрана модель: ${formatModelTitle(requestedModel)}`
      });

      await bot.editMessageText(listModelsMessage(chatId), {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: buildModelsKeyboard(chatId)
      });
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
