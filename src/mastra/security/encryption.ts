import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM =
  "aes-256-gcm";

const VERSION =
  "v1";

function getEncryptionKey():
  Buffer {
  const encoded =
    process.env
      .SOFTONE_CREDENTIALS_ENCRYPTION_KEY;

  if (!encoded) {
    throw new Error(
      "SOFTONE_CREDENTIALS_ENCRYPTION_KEY is not configured",
    );
  }

  let key: Buffer;

  try {
    key =
      Buffer.from(
        encoded,
        "base64",
      );
  } catch {
    throw new Error(
      "SOFTONE_CREDENTIALS_ENCRYPTION_KEY must be valid base64",
    );
  }

  if (key.length !== 32) {
    throw new Error(
      "SOFTONE_CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }

  return key;
}

export function encryptSecret(
  plaintext: string,
): string {
  const key =
    getEncryptionKey();

  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      ALGORITHM,
      key,
      iv,
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        plaintext,
        "utf8",
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(
  envelope: string,
): string {
  const [
    version,
    ivEncoded,
    tagEncoded,
    encryptedEncoded,
  ] = envelope.split(":");

  if (
    version !== VERSION ||
    !ivEncoded ||
    !tagEncoded ||
    !encryptedEncoded
  ) {
    throw new Error(
      "Invalid encrypted secret envelope",
    );
  }

  const key =
    getEncryptionKey();

  const iv =
    Buffer.from(
      ivEncoded,
      "base64url",
    );

  const authTag =
    Buffer.from(
      tagEncoded,
      "base64url",
    );

  const encrypted =
    Buffer.from(
      encryptedEncoded,
      "base64url",
    );

  const decipher =
    createDecipheriv(
      ALGORITHM,
      key,
      iv,
    );

  decipher.setAuthTag(
    authTag,
  );

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
