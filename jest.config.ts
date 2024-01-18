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
  // An array of regexp pattern strings used to skip coverage collection
  // coveragePathIgnorePatterns: [
  //   "/node_modules/"
  // ],

  coverageProvider: "v8",
  maxWorkers: 1,
  // testMatch: ["test/**/__tests__/**/*.[jt]s?(x)", "test/**/?(*.)+(spec|test).[tj]s?(x)"]
  testPathIgnorePatterns: ["/node_modules/", "/lib/", "src/config/test.ts"]
};

export default config;
