const { loadConfig } = require("./config/env");
const { createTelegramBot } = require("./bot/createTelegramBot");
const { registerHandlers } = require("./bot/registerHandlers");
const { createOllamaService } = require("./services/ollamaService");
const { createTelegramSender } = require("./services/telegramSender");

function startApp() {
  const config = loadConfig();
  const bot = createTelegramBot(config.telegram);
  const ollamaService = createOllamaService(config.ollama);
  const telegramSender = createTelegramSender(bot, config.telegram);

  bot
    .setMyCommands([
      { command: "start", description: "Запуск и помощь" },
      { command: "models", description: "Выбрать модель" }
    ])
    .catch((error) => {
      console.error("Failed to register bot commands:", error.message || error);
    });

  registerHandlers(bot, {
    ollamaService,
    telegramSender,
    ollamaConfig: config.ollama
  });

  console.log(`Bot started in polling mode. Default model: ${config.ollama.defaultModel}`);
}

module.exports = {
  startApp
};
