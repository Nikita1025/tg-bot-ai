const { EventEmitter } = require("node:events");

function createEventBus() {
  const emitter = new EventEmitter();

  function subscribe(eventType, handler) {
    emitter.on(eventType, handler);
    return () => emitter.off(eventType, handler);
  }

  async function publish(eventType, payload) {
    const listeners = emitter.listeners(eventType);
    for (const listener of listeners) {
      await listener(payload);
    }
  }

  return {
    subscribe,
    publish
  };
}

module.exports = {
  createEventBus
};
