const { Notification } = require("electron");

const APP_NAME = "Sidekick";

function notify(body, title = APP_NAME) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch {
    // deliberately ignored
  }
}

module.exports = { notify };
