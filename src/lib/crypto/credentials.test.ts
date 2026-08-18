import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

const { encryptCredentials, decryptCredentials, maskSecret } = await import('./credentials')

describe('credential encryption', () => {
  it('round-trips a credential object', () => {
    const creds = { apiKey: 'sk_live_abc123', projectId: 'proj1a2b' }
    expect(decryptCredentials(encryptCredentials(creds))).toEqual(creds)
  })

  it('produces different ciphertext for the same input', () => {
    const a = encryptCredentials({ apiKey: 'same' })
    const b = encryptCredentials({ apiKey: 'same' })
    expect(a.equals(b)).toBe(false)
  })

  it('rejects tampered ciphertext', () => {
    const payload = encryptCredentials({ apiKey: 'secret' })
    payload[payload.length - 1] ^= 0xff
    expect(() => decryptCredentials(payload)).toThrow()
  })

  it('rejects a truncated payload', () => {
    expect(() => decryptCredentials(Buffer.alloc(8))).toThrow(/truncated or corrupt/)
  })

  it('cannot be read with a different key', () => {
    const payload = encryptCredentials({ apiKey: 'secret' })
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    expect(() => decryptCredentials(payload)).toThrow()
  })
})

describe('maskSecret', () => {
  it('keeps only the ends of a long secret', () => {
    expect(maskSecret('sk_live_1234567890abcd')).toBe('sk_l••••abcd')
  })

  it('fully hides a short secret', () => {
    expect(maskSecret('abc')).toBe('••••')
  })
})
