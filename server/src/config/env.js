import { z } from 'zod'

const envSchema = z.object({
  PORT:                  z.string().default('4000'),
  NODE_ENV:              z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL:          z.string().optional(),
  REDIS_URL:             z.string().optional(),
  JWT_ACCESS_SECRET:     z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET:    z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN:z.string().default('30d'),
  CLIENT_URL:            z.string().default('http://localhost:3000'),
  VAPID_PUBLIC_KEY:      z.string().optional(),
  VAPID_PRIVATE_KEY:     z.string().optional(),
  VAPID_EMAIL:           z.string().optional(),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    console.error(`[env] Invalid environment variables:\n${issues}`)
    if (process.env.NODE_ENV === 'production') process.exit(1)
  }
  return result.data || process.env
}

export const env = validateEnv()
