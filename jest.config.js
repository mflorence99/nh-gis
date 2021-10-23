module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['./bin/**/*.ts', './src/**/*.ts'],
  coverageReporters: ['json-summary', 'text', 'html'],
  globals: {
    'ts-jest': {
      tsconfig: './tests/tsconfig.json'
    }
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './reports/junit' }]
  ],
  roots: ['./bin/', './src/', './tests/'],
  setupFilesAfterEnv: ['jest-extended'],
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  testResultsProcessor: 'jest-junit',
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  transformIgnorePatterns: ['^.+\\.js$']
};
