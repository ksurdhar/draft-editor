/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@wrappers/(.*)$': '<rootDir>/wrappers/$1',
    '^@typez/(.*)$': '<rootDir>/types/$1',
    '^@styles/(.*)$': '<rootDir>/styles/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js']
} 