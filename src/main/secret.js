// Encrypts the API key at rest with the OS keystore (DPAPI on Windows, Keychain
// on macOS, libsecret on Linux) via Electron's safeStorage. If encryption isn't
// available (e.g. a Linux box with no keyring), callers fall back to plaintext —
// a readable key beats a lost one.

const { safeStorage } = require("electron");

function available() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    // Not in a ready Electron main process (e.g. a headless test) — treat as unavailable.
    return false;
  }
}

/** @returns {string} base64 ciphertext, or "" if there's nothing/no encryption. */
function encrypt(plain) {
  if (!plain || !available()) return "";
  try {
    return safeStorage.encryptString(plain).toString("base64");
  } catch {
    return "";
  }
}

/** @returns {string} the plaintext, or "" if it can't be decrypted. */
function decrypt(base64) {
  if (!base64) return "";
  try {
    return safeStorage.decryptString(Buffer.from(base64, "base64"));
  } catch {
    // Wrong machine/user, or a corrupt blob — the key simply can't be recovered.
    return "";
  }
}

module.exports = { available, encrypt, decrypt };
