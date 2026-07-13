const { Notification } = require("electron");

const APP_NAME = "Sidekick";

/** Best-effort desktop notification — never throws, never blocks a flow. */
function notify(body, title = APP_NAME) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch {
    // Notifications are disabled or unsupported; nothing to do about it.
  }
}

module.exports = { notify };
