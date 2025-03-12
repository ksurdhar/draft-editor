/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@wrappers/(.*)$': '<rootDir>/wrappers/$1',
    '^@typez/(.*)$': '<rootDir>/types/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js',
  testTimeout: 30000,
}
