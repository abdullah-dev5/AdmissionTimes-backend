import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@config/config';

let authClient: SupabaseClient | null = null;

export const getSupabaseAuthClient = (): SupabaseClient | null => {
  if (!config.supabase.url || !config.supabase.anonKey) {
    return null;
  }
  if (!authClient) {
    authClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return authClient;
};
