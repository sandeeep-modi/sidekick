const { generate } = require("./client");
const { NO_EM_DASH } = require("./style");

function contextTurns(context) {
  const parts = [NO_EM_DASH];
  if (context?.trim()) parts.push(context.trim());

  return [
    {
      role: "user",
      parts: [
        {
          text: `[Background context - keep this in mind for the whole conversation]\n${parts.join("\n\n")}`,
        },
      ],
    },
    { role: "model", parts: [{ text: "Got it, I'll keep that in mind." }] },
  ];
}

function chatMessage({ history, userText, context, apiKey, model }) {
  const contents = [
    ...contextTurns(context),
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: "user", parts: [{ text: userText }] },
  ];

  return generate({ contents, apiKey, model, temperature: 0.8 });
}

module.exports = { chatMessage };
