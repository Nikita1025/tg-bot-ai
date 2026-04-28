/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.cjs"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};

