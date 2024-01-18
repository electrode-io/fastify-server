/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95
    }
  },
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  maxWorkers: 1,
  testPathIgnorePatterns: ["/node_modules/", "/lib/", "src/config/test.ts"]
};

export default config;
