const { EVENT_TYPES } = require("../src/events/eventTypes");
const { createConversationService } = require("../src/services/conversationService");

describe("conversationService (message handling orchestration)", () => {
  test("publishes events and uses history when context enabled", async () => {
    const usersService = {
      identifyUser: jest.fn(async () => ({ id: "u1", preferredModel: "m1" })),
      getPreferredModel: jest.fn(),
      setPreferredModel: jest.fn()
    };
    const historyService = {
      getAllMessages: jest.fn(async () => [{ role: "user", content: "hi" }])
    };
    const chatService = {
      generateReply: jest.fn(async () => ({
        replyText: "answer",
        userMessage: { role: "user", content: "ping" },
        assistantMessage: { role: "assistant", content: "answer" }
      }))
    };
    const eventBus = { publish: jest.fn(async () => {}) };

    const service = createConversationService({
      usersService,
      historyService,
      chatService,
      eventBus,
      contextEnabled: true
    });

    const identifiers = { telegramId: "t1", sessionId: "s1" };
    const result = await service.handleIncomingMessage({ identifiers, text: "ping" });

    expect(result).toEqual({ replyText: "answer", model: "m1" });
    expect(historyService.getAllMessages).toHaveBeenCalledWith("u1");
    expect(chatService.generateReply).toHaveBeenCalledWith({
      model: "m1",
      history: [{ role: "user", content: "hi" }],
      userText: "ping"
    });

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish.mock.calls[0][0]).toBe(EVENT_TYPES.MESSAGE_RECEIVED);
    expect(eventBus.publish.mock.calls[1][0]).toBe(EVENT_TYPES.RESPONSE_GENERATED);
    expect(eventBus.publish.mock.calls[0][1]).toMatchObject({
      dialogId: "u1",
      userId: "u1",
      identifiers,
      message: { role: "user", content: "ping" }
    });
    expect(eventBus.publish.mock.calls[1][1]).toMatchObject({
      dialogId: "u1",
      userId: "u1",
      identifiers,
      model: "m1",
      requestMessage: { role: "user", content: "ping" },
      message: { role: "assistant", content: "answer" }
    });
  });

  test("does not read history when context disabled", async () => {
    const usersService = {
      identifyUser: jest.fn(async () => ({ id: "u1", preferredModel: "m1" })),
      getPreferredModel: jest.fn(),
      setPreferredModel: jest.fn()
    };
    const historyService = { getAllMessages: jest.fn() };
    const chatService = {
      generateReply: jest.fn(async () => ({
        replyText: "answer",
        userMessage: { role: "user", content: "ping" },
        assistantMessage: { role: "assistant", content: "answer" }
      }))
    };
    const eventBus = { publish: jest.fn(async () => {}) };

    const service = createConversationService({
      usersService,
      historyService,
      chatService,
      eventBus,
      contextEnabled: false
    });

    await service.handleIncomingMessage({ identifiers: { telegramId: "t1" }, text: "ping" });

    expect(historyService.getAllMessages).not.toHaveBeenCalled();
    expect(chatService.generateReply.mock.calls[0][0].history).toEqual([]);
  });
});

