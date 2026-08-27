const { app } = require("electron");

const LOGIN_ARGS = ["--hidden"];

// Windows reports openAtLogin per (executable, args) pair: querying without the
// same args we registered with always reads back false, which used to look like
// a failure even when the login item was written correctly.
const query = () => app.getLoginItemSettings({ args: LOGIN_ARGS });

function isEnabled() {
  const settings = query();
  return Boolean(settings.openAtLogin || settings.executableWillLaunchAtLogin);
}

// Returns whether the OS ended up in the state we asked for.
function apply(enabled) {
  app.setLoginItemSettings({ openAtLogin: enabled, args: LOGIN_ARGS });
  return isEnabled() === enabled;
}

const wasOpenedAtLogin = () =>
  process.argv.includes("--hidden") || Boolean(query().wasOpenedAtLogin);

module.exports = { apply, wasOpenedAtLogin };
