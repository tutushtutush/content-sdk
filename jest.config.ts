import type { Config } from "jest";

const shared = {
  preset: "ts-jest",
  roots: ["<rootDir>/tests"],
  clearMocks: true,
};

const live = process.env.CONTENT_SDK_LIVE === "1";

// "node" runs everything; "jsdom" reruns the unit and contract tests as the
// browser-like environment of SC-002. The live test runs only on request.
const config: Config = {
  globalSetup: "<rootDir>/tests/setup/build.ts",
  projects: [
    {
      ...shared,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["**/*.test.ts"],
      testPathIgnorePatterns: live ? ["/tests/browser/"] : ["/tests/live/", "/tests/browser/"],
    },
    {
      ...shared,
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/tests/unit/**/*.test.ts",
        "<rootDir>/tests/contract/**/*.test.ts",
        "<rootDir>/tests/browser/**/*.test.ts",
      ],
      testPathIgnorePatterns: ["headless.test.ts"],
    },
  ],
};

module.exports = config;
