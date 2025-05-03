/** @type {import('ts-jest').JestConfigWithTsJest} */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseConfig = require('./jest.config.js')

module.exports = {
  ...baseConfig,
  testEnvironment: 'jsdom',
  // Only run dialogue-utils tests
  testMatch: ['**/__tests__/dialogue-utils.test.(ts|tsx|js)'],
}
