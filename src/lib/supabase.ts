import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolvePublicRuntimeConfig } from './runtimeConfig';

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : (typeof process !== 'undefined' ? process.env : {}) ?? {};

export const supabaseConfig = resolvePublicRuntimeConfig(env);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfig.isConfigured) return null;
  if (!client) {
    client = createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
