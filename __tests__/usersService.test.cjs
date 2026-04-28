const { EVENT_TYPES } = require("../src/events/eventTypes");
const { createUsersService } = require("../src/modules/users/usersService");

describe("usersService (business logic)", () => {
  test("identifyUser returns existing user without publishing USER_CREATED", async () => {
    const userRepository = {
      findByIdentifiers: jest.fn(async () => ({ id: "u1", telegramId: "1", sessionId: null, preferredModel: "m1" })),
      upsertByIdentifiers: jest.fn()
    };
    const eventBus = { publish: jest.fn(async () => {}) };
    const service = createUsersService({ userRepository, defaultModel: "def", eventBus });

    const user = await service.identifyUser({ telegramId: "1" });

    expect(user.id).toBe("u1");
    expect(userRepository.upsertByIdentifiers).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  test("identifyUser creates user with default model and publishes USER_CREATED", async () => {
    const created = { id: "u2", telegramId: "2", sessionId: null, preferredModel: "def" };
    const userRepository = {
      findByIdentifiers: jest.fn(async () => null),
      upsertByIdentifiers: jest.fn(async () => created)
    };
    const eventBus = { publish: jest.fn(async () => {}) };
    const service = createUsersService({ userRepository, defaultModel: "def", eventBus });

    const identifiers = { telegramId: "2" };
    const user = await service.identifyUser(identifiers);

    expect(user).toEqual(created);
    expect(userRepository.upsertByIdentifiers).toHaveBeenCalledWith(identifiers, { preferredModel: "def" });
    expect(eventBus.publish).toHaveBeenCalledWith(EVENT_TYPES.USER_CREATED, { user: created, identifiers });
  });

  test("getPreferredModel returns user's model or default when null", async () => {
    const userRepository = {
      findByIdentifiers: jest.fn(async () => ({ id: "u1", telegramId: "1", sessionId: null, preferredModel: null })),
      upsertByIdentifiers: jest.fn()
    };
    const service = createUsersService({ userRepository, defaultModel: "def" });

    const model = await service.getPreferredModel({ telegramId: "1" });
    expect(model).toBe("def");
  });

  test("setPreferredModel delegates to repository", async () => {
    const patched = { id: "u1", telegramId: "1", sessionId: null, preferredModel: "m2" };
    const userRepository = {
      findByIdentifiers: jest.fn(),
      upsertByIdentifiers: jest.fn(async () => patched)
    };
    const service = createUsersService({ userRepository, defaultModel: "def" });

    const result = await service.setPreferredModel({ telegramId: "1" }, "m2");
    expect(result).toEqual(patched);
  });
});

