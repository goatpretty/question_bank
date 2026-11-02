export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/config/runtime$': '<rootDir>/src/test/runtimeMock.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-markdown$': '<rootDir>/src/test/reactMarkdownMock.tsx',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/styleMock.cjs'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
};