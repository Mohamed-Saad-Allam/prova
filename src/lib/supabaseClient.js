import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist session in localStorage so it survives page reloads and new tabs
    persistSession: true,
    // Automatically refresh the access token before it expires
    autoRefreshToken: true,
    // Detect and exchange OAuth tokens from the URL hash/query after redirect
    detectSessionInUrl: true,
    // Fixed storage key so all tabs share the same session entry
    storageKey: 'prova_supabase_auth',
    // Use localStorage (default) for cross-tab availability
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/** True when real (non-placeholder) Supabase credentials are set */
export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder') &&
  typeof supabaseKey === 'string' &&
  supabaseKey.length > 50;
