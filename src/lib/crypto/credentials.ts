import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function key() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    )
  }

  const buffer = Buffer.from(raw, 'base64')
  if (buffer.length !== 32) {
    throw new Error(`CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes, got ${buffer.length}.`)
  }
  return buffer
}

/**
 * Provider credentials at rest. Layout is `iv || authTag || ciphertext`, so a
 * single bytea column round-trips without extra bookkeeping.
 *
 * Rotating CREDENTIALS_ENCRYPTION_KEY invalidates every stored credential —
 * connections must be re-established by their owners.
 */
export function encryptCredentials(value: unknown): Buffer {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
}

export function decryptCredentials<T = unknown>(payload: Buffer | Uint8Array): T {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)

  if (buffer.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Stored credential is truncated or corrupt.')
  }

  const iv = buffer.subarray(0, IV_LENGTH)
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buffer.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key(), iv)
  decipher.setAuthTag(tag)

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  return JSON.parse(plaintext) as T
}

/**
 * A non-secret hint for the dashboard, so a founder can tell which key is
 * connected without us ever showing the key.
 */
export function maskSecret(secret: string) {
  const trimmed = secret.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}
