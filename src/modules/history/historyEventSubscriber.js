const { EVENT_TYPES } = require("../../events/eventTypes");

function subscribeHistoryEvents(options) {
  const eventBus = options && options.eventBus;
  const historyService = options && options.historyService;
  const contextEnabled = options && options.contextEnabled !== false;

  if (!eventBus || !historyService) {
    throw new Error("History event subscriber requires eventBus and historyService");
  }

  if (!contextEnabled) {
    return () => {};
  }

  const unsubscribeMessageReceived = eventBus.subscribe(EVENT_TYPES.MESSAGE_RECEIVED, async (event) => {
    if (!event || !event.dialogId || !event.message) {
      return;
    }
    await historyService.appendMessage(event.dialogId, event.message);
  });

  const unsubscribeResponseGenerated = eventBus.subscribe(EVENT_TYPES.RESPONSE_GENERATED, async (event) => {
    if (!event || !event.dialogId || !event.message) {
      return;
    }
    await historyService.appendMessage(event.dialogId, event.message);
  });

  return () => {
    unsubscribeMessageReceived();
    unsubscribeResponseGenerated();
  };
}

module.exports = {
  subscribeHistoryEvents
};
