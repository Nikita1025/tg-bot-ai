const path = require("node:path");
const { loadConfig } = require("./config/env");
const { createTelegramBot } = require("./transport/telegram/createTelegramBot");
const { registerHandlers } = require("./transport/telegram/registerHandlers");
const { createLlmClient } = require("./modules/chat/llmClient");
const { createChatService } = require("./modules/chat/chatService");
const { createUserRepository } = require("./modules/users/userRepository");
const { createUsersService } = require("./modules/users/usersService");
const { createHistoryRepository } = require("./modules/history/historyRepository");
const { createHistoryService } = require("./modules/history/historyService");
const { subscribeHistoryEvents } = require("./modules/history/historyEventSubscriber");
const { createEventBus } = require("./events/eventBus");
const { createTelegramSender } = require("./transport/telegram/telegramSender");
const { createConversationService } = require("./services/conversationService");

function startApp() {
  const config = loadConfig();
  const bot = createTelegramBot(config.telegram);
  const eventBus = createEventBus();
  const llmClient = createLlmClient(config.ollama);
  const chatService = createChatService({
    llmClient,
    systemPrompt: config.ollama.systemPrompt
  });
  const userRepository = createUserRepository({
    storageFile: config.storage.usersStorageFile || path.join(process.cwd(), "data", "users", "users.yaml")
  });
  const usersService = createUsersService({
    userRepository,
    defaultModel: config.ollama.defaultModel,
    eventBus
  });
  const historyRepository = createHistoryRepository({
    storageDir: config.storage.dialogHistoryDir || path.join(process.cwd(), "data", "history")
  });
  const historyService = createHistoryService({
    historyRepository,
    maxMessages: config.storage.dialogHistoryMaxMessages
  });
  subscribeHistoryEvents({
    eventBus,
    historyService,
    contextEnabled: config.storage.contextEnabled
  });
  const telegramSender = createTelegramSender(bot, config.telegram);
  const conversationService = createConversationService({
    usersService,
    historyService,
    chatService,
    eventBus,
    contextEnabled: config.storage.contextEnabled
  });

  bot
    .setMyCommands([
      { command: "start", description: "Запуск и помощь" },
      { command: "models", description: "Выбрать модель" }
    ])
    .catch((error) => {
      console.error("Failed to register bot commands:", error.message || error);
    });

  registerHandlers(bot, {
    conversationService,
    telegramSender,
    ollamaConfig: config.ollama
  });

  console.log(`Bot started in polling mode. Default model: ${config.ollama.defaultModel}`);
}

module.exports = {
  startApp
};
