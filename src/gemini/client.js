// Low-level Gemini transport: one POST to generateContent, with the API's error
// shapes mapped to messages a user can act on. Uses global fetch (Node 18+).

const { DEFAULT_MODEL } = require("./models");

// Retry 5xx (usually a transient overload). 429 is NOT retried — it's a real quota
// limit, and hammering it makes things worse.
const RETRY_STATUSES = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [600, 1500];

// A rewrite can't be cancelled, so bound it: 30s means a slow model can't hang the
// app forever. Timeouts are retried like a 503 (usually a momentarily busy model).
const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTimeout = (error) => error?.name === "TimeoutError" || error?.name === "AbortError";

// The key goes in a header, not the query string — query params leak into logs most easily.
const endpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function errorFor(res) {
  let detail = "";
  try {
    detail = (await res.json())?.error?.message || "";
  } catch {
    // Non-JSON error body — the status alone will have to do.
  }

  if (res.status === 400 && /API key/i.test(detail)) {
    return new Error("Invalid API key. Check it in Settings.");
  }
  if (res.status === 404) {
    return new Error(`Model not available for your key (404). Try another model. ${detail}`.trim());
  }
  if (res.status === 429) {
    return new Error(`Quota or rate limit reached (429). ${detail}`.trim());
  }
  if (RETRY_STATUSES.has(res.status)) {
    // Only surfaces once the retries are exhausted.
    return new Error(`Model is busy right now (${res.status}). Try again in a moment.`);
  }
  return new Error(`Gemini error ${res.status}${detail ? `: ${detail}` : ""}`);
}

/**
 * @param {object} params
 * @param {Array<object>} params.contents      Gemini `contents` array.
 * @param {string} params.apiKey
 * @param {string} [params.model]
 * @param {number} [params.temperature]
 * @returns {Promise<string>} The model's reply text.
 */
async function generate({ contents, apiKey, model, temperature = 0.7 }) {
  if (!apiKey) throw new Error("NO_KEY");

  const url = endpoint(model || DEFAULT_MODEL);
  const request = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents, generationConfig: { temperature } }),
  };

  let res;
  for (let attempt = 1; ; attempt++) {
    const lastAttempt = attempt === MAX_ATTEMPTS;

    try {
      res = await fetch(url, { ...request, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (!isTimeout(error)) {
        // Keep the real cause for debugging; the user gets a plain message.
        console.error("Gemini request failed:", error);
        throw new Error("Network error — check your connection.", { cause: error });
      }
      if (lastAttempt) {
        throw new Error(
          "Timed out — the model is slow right now. Try again, or pick a faster model."
        );
      }
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
      continue;
    }

    if (res.ok) break;
    if (!RETRY_STATUSES.has(res.status) || lastAttempt) throw await errorFor(res);

    await res.body?.cancel(); // free the connection before retrying
    await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    const blocked = data?.promptFeedback?.blockReason;
    throw new Error(blocked ? `Blocked by safety filter (${blocked}).` : "No text returned.");
  }
  return text;
}

module.exports = { generate };
