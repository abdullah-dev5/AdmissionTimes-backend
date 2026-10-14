/**
 * Shared Supabase clients (server-side only).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@config/config';

const serverAuthOptions = { auth: { persistSession: false, autoRefreshToken: false } };

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/** Service-role client (bypasses RLS). Null when not configured. */
export const getSupabaseAdminClient = (): SupabaseClient | null => {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) return null;
  adminClient ??= createClient(config.supabase.url, config.supabase.serviceRoleKey, serverAuthOptions);
  return adminClient;
};

/** Anon-key client, used for password sign-in on behalf of API clients. */
export const getSupabaseAnonClient = (): SupabaseClient | null => {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  anonClient ??= createClient(config.supabase.url, config.supabase.anonKey, serverAuthOptions);
  return anonClient;
};
