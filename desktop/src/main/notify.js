const { Notification } = require("electron");

function notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch {}
}

module.exports = { notify };
