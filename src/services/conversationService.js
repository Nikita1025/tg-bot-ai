const { EVENT_TYPES } = require("../events/eventTypes");

function createConversationService(options) {
  const usersService = options && options.usersService;
  const historyService = options && options.historyService;
  const chatService = options && options.chatService;
  const eventBus = options && options.eventBus;
  const contextEnabled = options && options.contextEnabled !== false;

  if (!usersService || !historyService || !chatService || !eventBus) {
    throw new Error("Conversation service requires usersService, historyService, chatService and eventBus");
  }

  async function resolveContext(identifiers) {
    const user = await usersService.identifyUser(identifiers);
    const model = user.preferredModel;
    return {
      user,
      model
    };
  }

  async function getActiveModel(identifiers) {
    return usersService.getPreferredModel(identifiers);
  }

  async function setActiveModel(identifiers, model) {
    const user = await usersService.setPreferredModel(identifiers, model);
    return user.preferredModel;
  }

  async function handleIncomingMessage({ identifiers, text }) {
    const { user, model } = await resolveContext(identifiers);
    const dialogId = user.id;
    const history = contextEnabled ? await historyService.getAllMessages(dialogId) : [];
    const userMessage = { role: "user", content: text };

    await eventBus.publish(EVENT_TYPES.MESSAGE_RECEIVED, {
      dialogId,
      userId: user.id,
      identifiers,
      message: userMessage
    });

    const { replyText, userMessage: generatedUserMessage, assistantMessage } = await chatService.generateReply({
      model,
      history,
      userText: text
    });

    await eventBus.publish(EVENT_TYPES.RESPONSE_GENERATED, {
      dialogId,
      userId: user.id,
      identifiers,
      model,
      requestMessage: generatedUserMessage,
      message: assistantMessage
    });

    return {
      replyText,
      model
    };
  }

  return {
    getActiveModel,
    setActiveModel,
    handleIncomingMessage
  };
}

module.exports = {
  createConversationService
};
