const TelegramBot = require("node-telegram-bot-api");

function createTelegramBot(telegramConfig) {
  return new TelegramBot(telegramConfig.token, {
    polling: {
      autoStart: true,
      interval: telegramConfig.pollingIntervalMs,
      params: {
        timeout: telegramConfig.pollingTimeoutSec
      }
    }
  });
}

module.exports = {
  createTelegramBot
};
