// Rewrite engine. UI-agnostic so it can be reused outside Electron.
// Uses global fetch (Node 18+ / Electron main process).

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const MODELS = [
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite — fastest (recommended)" },
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash — higher quality" },
  { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest — always-current" },
];

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

const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

async function rewriteText(text, tone, apiKey, model) {
  if (!apiKey) throw new Error("NO_KEY");
  const mdl = model || DEFAULT_MODEL;
  const instruction = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;

  const prompt =
    `${instruction}\n\n` +
    `Return ONLY the rewritten text — no preamble, no quotation marks, no explanation, no options.\n\n` +
    `Text to rewrite:\n"""\n${text}\n"""`;

  let res;
  try {
    res = await fetch(endpoint(mdl, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });
  } catch {
    throw new Error("Network error — check your connection.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {}
    if (res.status === 400 && /API key/i.test(detail)) throw new Error("Invalid API key. Check it in Settings.");
    if (res.status === 404) throw new Error(`Model not available for your key (404). Try another model. ${detail}`);
    if (res.status === 429) throw new Error(`Quota/rate limit (429). ${detail || ""}`.trim());
    throw new Error(`Gemini error ${res.status}${detail ? ": " + detail : ""}`);
  }

  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!out) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(blocked ? `Blocked by safety filter (${blocked}).` : "No text returned.");
  }
  return out;
}

module.exports = { rewriteText, MODELS, TONES, TONE_PROMPTS, DEFAULT_MODEL };
