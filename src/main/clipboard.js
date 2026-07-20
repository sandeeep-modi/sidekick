const { execFile } = require("child_process");

// execFile (not exec): no shell, so args can't become shell injection.
function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

function sendHotkey(letter) {
  if (!/^[a-z]$/.test(letter)) throw new Error(`Invalid hotkey: ${letter}`);

  if (process.platform === "darwin") {
    return run("osascript", [
      "-e",
      `tell application "System Events" to keystroke "${letter}" using {command down}`,
    ]);
  }

  if (process.platform === "win32") {
    const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^${letter}')`;
    return run("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script]);
  }

  return run("xdotool", ["key", `ctrl+${letter}`]);
}

const copySelection = () => sendHotkey("c");
const pasteClipboard = () => sendHotkey("v");

module.exports = { copySelection, pasteClipboard };
