import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes is recommended for GCM

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

/**
 * Encrypts a plaintext message using AES-256-GCM.
 * @param text The plaintext message to encrypt.
 * @returns EncryptedMessage object containing the ciphertext, iv, authTag, and version.
 */
export function encryptMessage(text: string): EncryptedMessage {
  // We verified on startup that this is a 64-char hex string (32 bytes).
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is missing");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(text, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag,
    version: 1, // V1 encryption
  };
}

/**
 * Decrypts an EncryptedMessage payload back to plaintext.
 * @param payload The EncryptedMessage object.
 * @returns The decrypted plaintext string.
 */
export function decryptMessage(payload: EncryptedMessage): string {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("MESSAGE_ENCRYPTION_KEY is missing");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(payload.ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}
