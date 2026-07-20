const { listModels } = require("./client");

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const MODELS = [
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite — fastest (recommended)" },
  { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest — always-current" },
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash — best quality, tiny free quota" },
];

const HOW_MANY = 3;

const EXCLUDE = [
  /embedding/i,
  /aqa/i,
  /vision/i,
  /gemini-1\./i,
  /gemini-2\./i,
  /-tuning$/i,
];

function versionOf(id) {
  const m = id.match(/gemini-(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}

function variantScore(id) {
  if (/flash-lite/i.test(id)) return 3;
  if (/flash/i.test(id)) return 2;
  if (/pro/i.test(id)) return 0;
  return 1;
}

function labelFor(id, displayName) {
  if (/flash-lite/i.test(id)) return `${id} — fastest`;
  if (/flash/i.test(id)) return `${id} — balanced`;
  if (/pro/i.test(id)) return `${id} — highest quality, small free quota`;
  return displayName && displayName !== id ? `${id} — ${displayName}` : id;
}

function pickTopModels(apiModels) {
  const usable = apiModels
    .map((m) => ({
      id: String(m.name || "").replace(/^models\//, ""),
      displayName: m.displayName || "",
      methods: m.supportedGenerationMethods || [],
    }))
    .filter((m) => m.id && m.methods.includes("generateContent"))
    .filter((m) => !EXCLUDE.some((re) => re.test(m.id)));

  const seen = new Set();
  const unique = usable.filter((m) => (seen.has(m.id) ? false : seen.add(m.id)));

  unique.sort((a, b) => {
    const s = variantScore(b.id) - variantScore(a.id);
    if (s !== 0) return s;
    const v = versionOf(b.id) - versionOf(a.id);
    if (v !== 0) return v;
    return a.id.localeCompare(b.id);
  });

  return unique.slice(0, HOW_MANY).map((m) => ({ id: m.id, label: labelFor(m.id, m.displayName) }));
}

async function resolveModels(apiKey) {
  if (!apiKey) return MODELS;
  try {
    const picked = pickTopModels(await listModels(apiKey));
    return picked.length ? picked : MODELS;
  } catch {
    return MODELS;
  }
}

module.exports = { DEFAULT_MODEL, MODELS, pickTopModels, resolveModels };
