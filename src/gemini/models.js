const { listModels } = require("./client");

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const MODELS = [
  { id: "gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite — fastest (recommended)" },
  { id: "gemini-flash-lite-latest", label: "gemini-flash-lite-latest — always-current" },
  { id: "gemini-3.5-flash", label: "gemini-3.5-flash — best quality, tiny free quota" },
];

const HOW_MANY = 3;

// One pick per tier, best first: three flash-lite variants would all be "fastest".
const TIERS = [
  { test: /flash-lite/i, label: "fastest" },
  { test: /flash/i, label: "balanced" },
  { test: /pro/i, label: "highest quality, small free quota" },
];

const EXCLUDE = [/embedding/i, /aqa/i, /vision/i, /gemini-1\./i, /gemini-2\./i, /-tuning$/i];

function versionOf(id) {
  const m = id.match(/gemini-(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}

function tierOf(id) {
  return TIERS.find((tier) => tier.test.test(id)) || null;
}

function labelFor(id, displayName) {
  const tier = tierOf(id);
  if (tier) return `${id} — ${tier.label}`;
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

  // Newest version wins inside a tier; a numbered release beats an unversioned alias.
  unique.sort((a, b) => versionOf(b.id) - versionOf(a.id) || a.id.localeCompare(b.id));

  const picked = [];
  for (const tier of TIERS) {
    const best = unique.find((m) => tierOf(m.id) === tier);
    if (best) picked.push(best);
  }
  for (const m of unique) {
    if (picked.length >= HOW_MANY) break;
    if (!picked.includes(m)) picked.push(m);
  }

  return picked.slice(0, HOW_MANY).map((m, i) => ({
    id: m.id,
    label: `${labelFor(m.id, m.displayName)}${i === 0 ? " (recommended)" : ""}`,
  }));
}

// Throws on network/auth failure so callers can keep serving a cached list
// instead of persisting the built-in fallback for a week.
async function fetchTopModels(apiKey) {
  const picked = pickTopModels(await listModels(apiKey));
  return picked.length ? picked : MODELS;
}

module.exports = { DEFAULT_MODEL, MODELS, fetchTopModels };
