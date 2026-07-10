// Simulates Copy / Paste at the OS level using built-in tools (no native deps).
// macOS needs Accessibility permission; Linux needs xdotool installed.

const { exec } = require("child_process");

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

// Sends Ctrl/Cmd + <letter> to the currently focused application.
function send(letter) {
  if (isMac) {
    return run(`osascript -e 'tell application "System Events" to keystroke "${letter}" using {command down}'`);
  }
  if (isWin) {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^${letter}')`;
    return run(`powershell -NoProfile -WindowStyle Hidden -Command "${ps}"`);
  }
  return run(`xdotool key ctrl+${letter}`);
}

module.exports = { copy: () => send("c"), paste: () => send("v") };
