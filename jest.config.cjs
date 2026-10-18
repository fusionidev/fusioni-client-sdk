module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.cjs'],
  transform: {'^.+\\.tsx?$': '<rootDir>/scripts/jest-typescript.cjs'},
  moduleNameMapper: {'\\.css$': '<rootDir>/tests/style-mock.cjs'},
  clearMocks: true,
};
