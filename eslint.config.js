const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/", "dist/", "build/", "icons/"] },

  js.configs.recommended,

  // Main process, preloads and tooling: CommonJS, Node globals.
  {
    files: [
      "src/main/**/*.js",
      "src/gemini/**/*.js",
      "src/preload/**/*.js",
      "scripts/**/*.js",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },

  // Renderers: ES modules, browser globals, no Node access (contextIsolation).
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser },
    },
  },

  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
    },
  },

  // Build scripts report to whoever ran them. Comes after the block above so it wins.
  {
    files: ["scripts/**/*.js"],
    rules: { "no-console": "off" },
  },

  // Turns off the stylistic rules Prettier owns. Must stay last.
  prettier,
];
