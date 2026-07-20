const { generate } = require("./client");
const { TONE_PROMPTS, DEFAULT_TONE } = require("./tones");
const { NO_EM_DASH } = require("./style");

function rewriteText(text, tone, apiKey, model) {
  const instruction = TONE_PROMPTS[tone] || TONE_PROMPTS[DEFAULT_TONE];
  const prompt = [
    instruction,
    NO_EM_DASH,
    "Return ONLY the rewritten text - no preamble, no quotation marks, no explanation, no options.",
    `Text to rewrite:\n"""\n${text}\n"""`,
  ].join("\n\n");

  return generate({
    contents: [{ parts: [{ text: prompt }] }],
    apiKey,
    model,
    temperature: 0.7,
  });
}

module.exports = { rewriteText };
