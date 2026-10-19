import { createClient } from '@supabase/supabase-js';

let client = null;

// Only used to upload files straight to storage (the backend gives the permission)
export function getSupabase() {
  if (!client) {
    const url = process.env.REACT_APP_SUPABASE_URL;
    const key = process.env.REACT_APP_SUPABASE_KEY;
    if (!url || !key) throw new Error('Photo upload is not set up yet');
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return client;
}