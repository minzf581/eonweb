module.exports = {
    testEnvironment: 'node',
    testTimeout: 10000,
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    testMatch: ['**/tests/**/*.test.js'],
};
