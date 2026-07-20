const { safeStorage } = require("electron");

function available() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encrypt(plain) {
  if (!plain || !available()) return "";
  try {
    return safeStorage.encryptString(plain).toString("base64");
  } catch {
    return "";
  }
}

function decrypt(base64) {
  if (!base64) return "";
  try {
    return safeStorage.decryptString(Buffer.from(base64, "base64"));
  } catch {
    return "";
  }
}

module.exports = { available, encrypt, decrypt };
