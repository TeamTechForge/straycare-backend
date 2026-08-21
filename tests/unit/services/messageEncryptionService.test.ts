import { encryptMessage, decryptMessage } from "../../../src/services/messageEncryptionService";

describe("messageEncryptionService", () => {
  const mockKey = "6ea429d1f4e6d5ae68a08fc6ec92c659c141c68bf4bef8eba322da5ea0de646c";

  beforeAll(() => {
    // Set a predictable key for testing
    process.env.MESSAGE_ENCRYPTION_KEY = mockKey;
  });

  afterAll(() => {
    delete process.env.MESSAGE_ENCRYPTION_KEY;
  });

  it("should encrypt a message so it is different from plaintext", () => {
    const plaintext = "Hello, this is a secret!";
    const encrypted = encryptMessage(plaintext);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toEqual(plaintext);
    expect(encrypted.ciphertext).not.toContain(plaintext);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.version).toBe(1);
  });

  it("should accurately decrypt an encrypted message back to original plaintext", () => {
    const plaintext = "Hello, this is another secret!";
    const encrypted = encryptMessage(plaintext);
    const decrypted = decryptMessage(encrypted);

    expect(decrypted).toEqual(plaintext);
  });

  it("should generate different ciphertexts and IVs for the same plaintext", () => {
    const plaintext = "This text should look different each time.";
    const encrypted1 = encryptMessage(plaintext);
    const encrypted2 = encryptMessage(plaintext);

    expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
  });

  it("should fail to decrypt if ciphertext is tampered with", () => {
    const plaintext = "Tamper with this message";
    const encrypted = encryptMessage(plaintext);

    // Tamper with the ciphertext by changing a character
    const tamperedCiphertext =
      encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 1) +
      (encrypted.ciphertext.endsWith("0") ? "1" : "0");

    const tamperedMessage = {
      ...encrypted,
      ciphertext: tamperedCiphertext,
    };

    expect(() => {
      decryptMessage(tamperedMessage);
    }).toThrow(); // AES-GCM should throw an error on tampered data
  });

  it("should fail to decrypt if authTag is tampered with", () => {
    const plaintext = "Tamper with auth tag";
    const encrypted = encryptMessage(plaintext);

    const tamperedAuthTag =
      encrypted.authTag.substring(0, encrypted.authTag.length - 1) +
      (encrypted.authTag.endsWith("0") ? "1" : "0");

    const tamperedMessage = {
      ...encrypted,
      authTag: tamperedAuthTag,
    };

    expect(() => {
      decryptMessage(tamperedMessage);
    }).toThrow();
  });
});
