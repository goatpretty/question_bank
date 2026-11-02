module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/test-support/learning-flow.setup.cjs'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', jsx: 'react-jsx', esModuleInterop: true }, diagnostics: false }] },
  testMatch: ['<rootDir>/src/__tests__/learning-flow.test.tsx', '<rootDir>/src/__tests__/exam-management.test.tsx', '<rootDir>/src/__tests__/exam-navigation.test.tsx', '<rootDir>/src/__tests__/question-browser.test.tsx', '<rootDir>/src/__tests__/wrongbook.test.tsx'],
};
