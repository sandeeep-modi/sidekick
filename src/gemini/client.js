const FALLBACK_MODEL = "gemini-3.1-flash-lite";

const RETRY_STATUSES = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [600, 1500];

const REQUEST_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTimeout = (error) => error?.name === "TimeoutError" || error?.name === "AbortError";

const endpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function errorFor(res) {
  let detail = "";
  try {
    detail = (await res.json())?.error?.message || "";
  } catch {
    // no JSON body: fall through to the status-only message
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
    return new Error(`Model is busy right now (${res.status}). Try again in a moment.`);
  }
  return new Error(`Gemini error ${res.status}${detail ? `: ${detail}` : ""}`);
}

async function generate({ contents, apiKey, model, temperature = 0.7 }) {
  if (!apiKey) throw new Error("NO_KEY");

  const url = endpoint(model || FALLBACK_MODEL);
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

    await res.body?.cancel();
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

async function listModels(apiKey) {
  if (!apiKey) throw new Error("NO_KEY");

  const url = "https://generativelanguage.googleapis.com/v1beta/models";
  let res;
  try {
    res = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error("Network error while listing models.", { cause: error });
  }
  if (!res.ok) throw await errorFor(res);

  const data = await res.json();
  return Array.isArray(data?.models) ? data.models : [];
}

module.exports = { generate, listModels };
