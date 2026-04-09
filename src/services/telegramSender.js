const { splitTextToChunks } = require("../utils/text");

function createTelegramSender(bot, telegramConfig) {
  async function sendLongMessage(chatId, text) {
    const chunks = splitTextToChunks(text, telegramConfig.maxMessageLength);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk);
    }
  }

  return {
    sendLongMessage
  };
}

module.exports = {
  createTelegramSender
};
