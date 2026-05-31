import { pbkdf2Sync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string) {
  const salt = crypto.randomUUID()
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')

  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(':')

  if (!salt || !expectedHash) {
    return false
  }

  const actualHash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')

  return timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'))
}

export function hashToken(token: string) {
  return pbkdf2Sync(token, 'vocalendar-session', 10_000, 32, 'sha256').toString('hex')
}
