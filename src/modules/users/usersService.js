const { EVENT_TYPES } = require("../../events/eventTypes");

function createUsersService(options) {
  const userRepository = options && options.userRepository;
  const defaultModel = options && options.defaultModel ? options.defaultModel : null;
  const eventBus = options && options.eventBus;

  if (!userRepository) {
    throw new Error("Users service requires userRepository");
  }

  async function identifyUser(identifiers) {
    const existingUser = await userRepository.findByIdentifiers(identifiers);
    if (existingUser) {
      return existingUser;
    }

    const createdUser = await userRepository.upsertByIdentifiers(identifiers, {
      preferredModel: defaultModel
    });

    if (eventBus) {
      await eventBus.publish(EVENT_TYPES.USER_CREATED, {
        user: createdUser,
        identifiers
      });
    }

    return createdUser;
  }

  async function getPreferredModel(identifiers) {
    const user = await identifyUser(identifiers);
    return user.preferredModel || defaultModel;
  }

  async function setPreferredModel(identifiers, model) {
    return userRepository.upsertByIdentifiers(identifiers, {
      preferredModel: model
    });
  }

  return {
    identifyUser,
    getPreferredModel,
    setPreferredModel
  };
}

module.exports = {
  createUsersService
};
