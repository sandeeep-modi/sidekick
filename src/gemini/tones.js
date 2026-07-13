const TONES = [
  { id: "professional", title: "Professional" },
  { id: "polite", title: "Polite" },
  { id: "concise", title: "Concise" },
  { id: "casual", title: "Casual / Team" },
];

const TONE_PROMPTS = {
  professional:
    "Rewrite the text in a polished, professional tone suitable for workplace communication. Keep the original meaning and any concrete details.",
  polite:
    "Rewrite the text to be warmer, more polite and courteous, while keeping the same meaning and information.",
  concise:
    "Rewrite the text to be as concise and clear as possible. Remove filler, keep every important point.",
  casual:
    "Rewrite the text as a casual, friendly message to a teammate (Slack/Teams style). Keep it short and natural — not corporate, formal, or stiff.",
};

const DEFAULT_TONE = "professional";

const toneTitle = (id) => TONES.find((t) => t.id === id)?.title || "";

module.exports = { TONES, TONE_PROMPTS, DEFAULT_TONE, toneTitle };
