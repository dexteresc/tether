import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

function requireViteEnv(key: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

const supabaseUrl = requireViteEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = requireViteEnv('VITE_SUPABASE_ANON_KEY')

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
