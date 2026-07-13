const { generate } = require("./client");

// Flash Lite has no system role, so standing context is injected as a synthetic
// opening exchange — well-supported, and the model treats it as prior agreement.
function contextTurns(context) {
  if (!context?.trim()) return [];
  return [
    {
      role: "user",
      parts: [
        {
          text: `[Background context — keep this in mind for the whole conversation]\n${context.trim()}`,
        },
      ],
    },
    { role: "model", parts: [{ text: "Got it, I'll keep that context in mind." }] },
  ];
}

/**
 * Send one chat turn, with the prior turns for context.
 * @param {object} params
 * @param {Array<{role: "user"|"model", text: string}>} params.history  Turns before this one.
 * @param {string} params.userText  The new user message.
 * @param {string} [params.context] Standing instruction from Settings.
 * @returns {Promise<string>} The model's reply.
 */
function chatMessage({ history, userText, context, apiKey, model }) {
  const contents = [
    ...contextTurns(context),
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  return generate({ contents, apiKey, model, temperature: 0.8 });
}

module.exports = { chatMessage };
