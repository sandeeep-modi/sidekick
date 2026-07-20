const { app, Menu } = require("electron");

function installAppMenu({ onQuit }) {
  if (process.platform !== "darwin") return;

  const template = [
    {
      label: app.name,
      submenu: [{ label: `Quit ${app.name}`, accelerator: "Command+Q", click: onQuit }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { installAppMenu };
