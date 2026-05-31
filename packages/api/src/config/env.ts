export type ApiEnv = {
  port: number
  nodeEnv: 'development' | 'test' | 'production'
  database: {
    url: string
  }
  redis: {
    url: string
  }
  jwt: {
    accessSecret: string
    refreshSecret: string
    accessTtl: string
    refreshTtl: string
  }
  voice: {
    aliyun: {
      accessKeyId: string
      accessKeySecret: string
      nlsAppKey: string
      asrRegion: string
      ttsRegion: string
      gatewayUrl: string
      tokenDomain: string
      tokenTtlSeconds: number
      defaultLanguage: string
    }
  }
  export: {
    tempDir: string
  }
}

type EnvSource = Record<string, string | undefined>

const DEFAULT_PORT = 8061
const DEFAULT_NODE_ENV = 'development'
const DEFAULT_JWT_ACCESS_TTL = '15m'
const DEFAULT_JWT_REFRESH_TTL = '30d'
const DEFAULT_ASR_REGION = 'cn-shanghai'
const DEFAULT_TTS_REGION = 'cn-shanghai'
const DEFAULT_GATEWAY_URL = 'wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1'
const DEFAULT_TOKEN_DOMAIN = 'nls-meta.cn-shanghai.aliyuncs.com'
const DEFAULT_TOKEN_TTL_SECONDS = 3600
const DEFAULT_LANGUAGE = 'zh-CN'
const DEFAULT_EXPORT_TEMP_DIR = '/tmp/vocalendar-export'

export function loadApiEnv(source: EnvSource): ApiEnv {
  const errors: string[] = []

  const port = readPort(source.PORT, errors)
  const nodeEnv = readNodeEnv(source.NODE_ENV, errors)
  const databaseUrl = readUrl('DATABASE_URL', source.DATABASE_URL, errors)
  const redisUrl = readUrl('REDIS_URL', source.REDIS_URL, errors)
  const jwtAccessSecret = readRequiredString('JWT_ACCESS_SECRET', source.JWT_ACCESS_SECRET, errors)
  const jwtRefreshSecret = readRequiredString(
    'JWT_REFRESH_SECRET',
    source.JWT_REFRESH_SECRET,
    errors,
  )
  const accessKeyId = readRequiredString(
    'ALIYUN_ACCESS_KEY_ID',
    source.ALIYUN_ACCESS_KEY_ID,
    errors,
  )
  const accessKeySecret = readRequiredString(
    'ALIYUN_ACCESS_KEY_SECRET',
    source.ALIYUN_ACCESS_KEY_SECRET,
    errors,
  )
  const nlsAppKey = readRequiredString('ALIYUN_NLS_APP_KEY', source.ALIYUN_NLS_APP_KEY, errors)
  const gatewayUrl = readUrl(
    'ALIYUN_NLS_GATEWAY_URL',
    source.ALIYUN_NLS_GATEWAY_URL ?? DEFAULT_GATEWAY_URL,
    errors,
  )
  const tokenTtlSeconds = readPositiveInteger(
    'ALIYUN_NLS_TOKEN_TTL_SECONDS',
    source.ALIYUN_NLS_TOKEN_TTL_SECONDS ?? String(DEFAULT_TOKEN_TTL_SECONDS),
    errors,
  )

  if (errors.length > 0) {
    throw new Error(`Invalid API environment: ${errors.join('; ')}`)
  }

  return {
    port,
    nodeEnv,
    database: {
      url: databaseUrl,
    },
    redis: {
      url: redisUrl,
    },
    jwt: {
      accessSecret: jwtAccessSecret,
      refreshSecret: jwtRefreshSecret,
      accessTtl: source.JWT_ACCESS_TTL?.trim() || DEFAULT_JWT_ACCESS_TTL,
      refreshTtl: source.JWT_REFRESH_TTL?.trim() || DEFAULT_JWT_REFRESH_TTL,
    },
    voice: {
      aliyun: {
        accessKeyId,
        accessKeySecret,
        nlsAppKey,
        asrRegion: source.ALIYUN_ASR_REGION?.trim() || DEFAULT_ASR_REGION,
        ttsRegion: source.ALIYUN_TTS_REGION?.trim() || DEFAULT_TTS_REGION,
        gatewayUrl,
        tokenDomain: source.ALIYUN_NLS_TOKEN_DOMAIN?.trim() || DEFAULT_TOKEN_DOMAIN,
        tokenTtlSeconds,
        defaultLanguage: source.ALIYUN_DEFAULT_LANGUAGE?.trim() || DEFAULT_LANGUAGE,
      },
    },
    export: {
      tempDir: source.EXPORT_TEMP_DIR?.trim() || DEFAULT_EXPORT_TEMP_DIR,
    },
  }
}

function readPort(value: string | undefined, errors: string[]) {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT
  }

  const port = Number(value)

  if (!Number.isInteger(port) || port <= 0) {
    errors.push('PORT must be a positive integer')
    return DEFAULT_PORT
  }

  return port
}

function readNodeEnv(
  value: string | undefined,
  errors: string[],
): 'development' | 'test' | 'production' {
  const normalized = value?.trim() || DEFAULT_NODE_ENV

  if (normalized === 'development' || normalized === 'test' || normalized === 'production') {
    return normalized
  }

  errors.push('NODE_ENV must be development, test, or production')

  return DEFAULT_NODE_ENV
}

function readRequiredString(name: string, value: string | undefined, errors: string[]) {
  const normalized = value?.trim() || ''

  if (normalized.length === 0) {
    errors.push(`${name} is required`)
  }

  return normalized
}

function readUrl(name: string, value: string | undefined, errors: string[]) {
  const normalized = readRequiredString(name, value, errors)

  if (normalized.length === 0) {
    return normalized
  }

  try {
    const url = new URL(normalized)

    return url.toString()
  } catch {
    errors.push(`${name} must be a valid URL`)
    return normalized
  }
}

function readPositiveInteger(name: string, value: string | undefined, errors: string[]) {
  const normalized = readRequiredString(name, value, errors)
  const parsed = Number(normalized)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive integer`)
    return DEFAULT_TOKEN_TTL_SECONDS
  }

  return parsed
}
