/** @type {import('@stryker-mutator/api/core').StrykerOptions} */
const config = {
  testRunner: "vitest",
  appendPlugins: ["@stryker-mutator/vitest-runner"],
  reporters: ["clear-text", "html"],
  coverageAnalysis: "perTest",
  concurrency: 4,
  cleanTempDir: true,
  ignorePatterns: [
    "packages/*/coverage",
    "**/dist",
    "**/.next",
    ".claude",
    "ui-concepts",
  ],
};

export default config;
