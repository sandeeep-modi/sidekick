// Reword — rewrite engine. UI-agnostic; kept in sync with the desktop app
// (desktop/src/shared/gemini.js).

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

// If one returns "limit: 0" or 404, pick another in Options.
export const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];

const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    key
  )}`;

export const TONE_PROMPTS = {
  professional:
    "Rewrite the text in a polished, professional tone suitable for workplace communication. Keep the original meaning and any concrete details.",
  polite:
    "Rewrite the text to be warmer, more polite and courteous, while keeping the same meaning and information.",
  concise:
    "Rewrite the text to be as concise and clear as possible. Remove filler, keep every important point.",
  casual:
    "Rewrite the text as a casual, friendly message to a teammate (Slack/Teams style). Keep it short and natural — not corporate, formal, or stiff.",
};

export const TONES = [
  { id: "professional", title: "Professional" },
  { id: "polite", title: "Polite" },
  { id: "concise", title: "Concise" },
  { id: "casual", title: "Casual / Team" },
];

/**
 * Rewrite `text` in the given `tone` using Gemini.
 * @returns {Promise<string>} the rewritten text
 * @throws {Error} on missing key, network, or API errors
 */
export async function rewriteText(text, tone, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) throw new Error("NO_KEY");
  const instruction = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;

  const prompt =
    `${instruction}\n\n` +
    `Return ONLY the rewritten text — no preamble, no quotation marks, no explanation, no options.\n\n` +
    `Text to rewrite:\n"""\n${text}\n"""`;

  let res;
  try {
    res = await fetch(endpoint(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });
  } catch (e) {
    throw new Error("Network error — check your connection.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || "";
    } catch {}
    if (res.status === 400 && /API key/i.test(detail))
      throw new Error("Invalid API key. Check it in Options.");
    if (res.status === 429)
      throw new Error(
        "Quota/rate limit (429). " +
          (detail || "No detail returned.") +
          " — free tier has low per-minute limits; wait ~60s and retry."
      );
    throw new Error(`Gemini error ${res.status}${detail ? ": " + detail : ""}`);
  }

  const data = await res.json();
  const out =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!out) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(
      blocked ? `Blocked by safety filter (${blocked}).` : "No text returned."
    );
  }
  return out;
}
