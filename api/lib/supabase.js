import { createClient } from '@supabase/supabase-js';

let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key);
  return _client;
}

/**
 * Log a demo usage to Supabase.
 * Fires and forgets — never throws, so a DB error never breaks a demo.
 */
export async function logDemo(demoType, inputData, result, metadata = {}) {
  const client = getClient();
  if (!client) return; // Supabase env vars not set — skip silently
  try {
    await client.from('demo_logs').insert({
      demo_type: demoType,
      input_data: inputData,
      result,
      metadata,
    });
  } catch (err) {
    console.error('[supabase] log error:', err?.message);
  }
}
