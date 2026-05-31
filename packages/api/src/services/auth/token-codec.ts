import { createHmac, timingSafeEqual } from 'node:crypto'

type TokenCodecConfig = {
  issuer: string
  accessSecret: string
  refreshSecret: string
  accessTtl: string
  refreshTtl: string
}

type TokenSubject = {
  userId: string
  sessionId: string
}

type TokenType = 'access' | 'refresh'

type TokenPayload = {
  iss: string
  sub: string
  jti: string
  iat: number
  exp: number
  sessionId: string
  tokenType: TokenType
}

export function createTokenCodec(config: TokenCodecConfig) {
  return {
    signAccessToken(subject: TokenSubject) {
      return signToken(config, subject, 'access')
    },
    signRefreshToken(subject: TokenSubject) {
      return signToken(config, subject, 'refresh')
    },
    verifyAccessToken(token: string) {
      return verifyToken(config, token, 'access')
    },
    verifyRefreshToken(token: string) {
      return verifyToken(config, token, 'refresh')
    },
  }
}

async function signToken(config: TokenCodecConfig, subject: TokenSubject, tokenType: TokenType) {
  const now = Math.floor(Date.now() / 1000)
  const ttl = parseTtlSeconds(tokenType === 'access' ? config.accessTtl : config.refreshTtl)
  const payload: TokenPayload = {
    iss: config.issuer,
    sub: subject.userId,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttl,
    sessionId: subject.sessionId,
    tokenType,
  }
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const encodedHeader = encodeBase64Url(JSON.stringify(header))
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = sign(`${encodedHeader}.${encodedPayload}`, getSecret(config, tokenType))

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

async function verifyToken(config: TokenCodecConfig, token: string, expectedType: TokenType) {
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new Error('JWT must contain three segments')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as TokenPayload
  const expectedSignature = sign(
    `${encodedHeader}.${encodedPayload}`,
    getSecret(config, payload.tokenType),
  )

  if (!safeEqual(encodedSignature, expectedSignature)) {
    throw new Error('JWT signature verification failed')
  }

  const now = Math.floor(Date.now() / 1000)

  if (payload.iss !== config.issuer) {
    throw new Error('JWT issuer mismatch')
  }

  if (payload.tokenType !== expectedType) {
    throw new Error(`JWT tokenType mismatch: expected ${expectedType}`)
  }

  if (payload.exp <= now) {
    throw new Error('JWT expired')
  }

  return payload
}

function getSecret(config: TokenCodecConfig, tokenType: TokenType) {
  return tokenType === 'access' ? config.accessSecret : config.refreshSecret
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function parseTtlSeconds(value: string) {
  const match = /^(\d+)([smhd])$/i.exec(value.trim())

  if (!match) {
    throw new Error(`Unsupported TTL format: ${value}`)
  }

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()

  if (unit === 's') {
    return amount
  }

  if (unit === 'm') {
    return amount * 60
  }

  if (unit === 'h') {
    return amount * 60 * 60
  }

  return amount * 24 * 60 * 60
}

export type AccessTokenPayload = Awaited<
  ReturnType<ReturnType<typeof createTokenCodec>['verifyAccessToken']>
>
export type RefreshTokenPayload = Awaited<
  ReturnType<ReturnType<typeof createTokenCodec>['verifyRefreshToken']>
>
