import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "econnect_default_enc_key_32_chars_long!!"; // Must be 32 chars
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypts a plain text string
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text in format: iv:encryptedData
 */
export function encrypt(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.substring(0, 32)),
      iv,
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts an encrypted string
 * @param {string} text - The encrypted text in format: iv:encryptedData
 * @returns {string} - The decrypted plain text
 */
export function decrypt(text) {
  if (!text) return null;

  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.substring(0, 32)),
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption error:", error);
    // Return the original text if decryption fails (might be unencrypted or wrong key)
    // In production, we should probably throw an error
    return text;
  }
}

export default { encrypt, decrypt };
