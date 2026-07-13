// The spinner pill. Main drives it over "overlay:state"; it never talks back.

const icon = document.getElementById("icon");
const label = document.getElementById("label");

const STATES = {
  loading: (text) => ({
    iconClass: "spinner",
    iconText: "",
    labelClass: "label",
    labelText: text ? `${text} — Rewriting…` : "Rewriting…",
  }),
  done: (text) => ({
    iconClass: "badge done",
    iconText: "✓",
    labelClass: "label",
    labelText: text || "Done",
  }),
  error: (text) => ({
    iconClass: "badge error",
    iconText: "!",
    labelClass: "label muted",
    labelText: text || "Error",
  }),
};

window.api.onState(({ state, text }) => {
  const view = (STATES[state] || STATES.loading)(text);

  icon.className = view.iconClass;
  icon.textContent = view.iconText;
  label.className = view.labelClass;
  label.textContent = view.labelText;
});
