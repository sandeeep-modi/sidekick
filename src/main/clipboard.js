// Simulates Copy / Paste at the OS level using built-in tools (no native deps),
// so the rewrite can read and replace a selection in any other app.
//
// Windows: PowerShell SendKeys. macOS: osascript (needs Accessibility permission,
// prompted on first use). Linux: xdotool (must be installed separately).

const { execFile } = require("child_process");

// execFile (not exec) means no shell is involved and args are passed as an array,
// so nothing here can be turned into shell injection. The letter is validated too,
// as belt-and-suspenders in case a future caller passes something other than c/v.
function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/** Send Ctrl/Cmd + <letter> to whichever app currently has focus. */
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
