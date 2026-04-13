import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Log a demo usage to Supabase.
 * Fires and forgets — never throws, so a DB error never breaks a demo.
 */
export async function logDemo(demoType, inputData, result, metadata = {}) {
  if (!supabaseUrl || !supabaseKey) return;
  try {
    await supabase.from('demo_logs').insert({
      demo_type: demoType,
      input_data: inputData,
      result,
      metadata,
    });
  } catch (err) {
    console.error('[supabase] log error:', err?.message);
  }
}
