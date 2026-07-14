// A fresh free-tier key only works on the 3.x family (2.0 → 429, 2.5 → 404). The lite
// models have a real quota and sub-second replies, so they stay the default;
// gemini-3.5-flash 429s after ~5 requests, so it's offered but not the default.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const MODELS = [
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite — fastest (recommended)" },
  { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest — always-current" },
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash — best quality, tiny free quota" },
];

module.exports = { DEFAULT_MODEL, MODELS };
