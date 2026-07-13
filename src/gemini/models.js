// A brand-new free-tier key is only provisioned for the 3.x family: 2.0 returns
// 429 `limit: 0` and 2.5 returns 404. Keep this list to models a fresh key can use.
//
// Free-tier quotas differ wildly per model. gemini-3.5-flash allows only ~5 requests
// before it 429s ("limit: 5" on generate_content_free_tier_requests) and it 503s under
// load — fine for the occasional rewrite, useless as a daily driver. The lite models
// have a real quota and answer in under a second, so they stay the default.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const MODELS = [
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite — fastest (recommended)" },
  { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest — always-current" },
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash — best quality, tiny free quota" },
];

module.exports = { DEFAULT_MODEL, MODELS };
