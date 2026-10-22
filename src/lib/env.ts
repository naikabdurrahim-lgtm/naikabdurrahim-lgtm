import { z } from 'zod';

/**
 * Environment access in one place. Values are read from Vite's `import.meta.env`
 * and validated at startup so a typo fails loudly in development instead of
 * silently producing a broken app.
 *
 * Supabase is optional in Phase 1: the app boots without it and the health
 * check explains what to fix. From Phase 2 onward a missing config blocks the
 * data features, never the shell.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  VITE_AI_SERVICE_URL: z.string().url().optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).optional(),
  MODE: z.string().optional(),
  DEV: z.boolean().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

function readEnv(): AppEnv {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_AI_SERVICE_URL: import.meta.env.VITE_AI_SERVICE_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    // Never log values — only which keys are wrong.
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    console.error(`Invalid environment configuration for: ${keys}. Check your .env file.`);
    return { MODE: raw.MODE, DEV: raw.DEV };
  }
  return parsed.data;
}

export const env = readEnv();

export const isSupabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

/** Public, non-secret runtime flags the UI can read. */
export const appConfig = {
  name: 'Dokan Bondhu',
  version: __APP_VERSION__,
  mode: env.VITE_APP_ENV ?? env.MODE ?? 'development',
  isDev: env.DEV ?? false,
  aiServiceUrl: env.VITE_AI_SERVICE_URL ?? '',
  supabaseConfigured: isSupabaseConfigured,
} as const;
