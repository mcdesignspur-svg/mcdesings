import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT || 'mc-default-salt';

let _client = null;
function db() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function hashIp(ip) {
  return createHash('sha256').update(`${RATE_LIMIT_SALT}|${ip}`).digest('hex').slice(0, 32);
}

/**
 * Sliding-window rate limit backed by Supabase api_rate_limits table.
 * Shared across endpoints — pass a unique `bucket` per endpoint.
 *
 * Fail-open if Supabase env is missing (dev mode), so the demo doesn't break locally.
 */
export async function checkRateLimit(req, bucket, { perHour = 30, perDay = 200 } = {}) {
  const client = db();
  if (!client) return { ok: true };

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: hourCount } = await client
    .from('api_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('ip_hash', ipHash)
    .gte('created_at', hourAgo);

  if ((hourCount ?? 0) >= perHour) {
    return { ok: false, retryAfter: 3600, reason: 'Demasiados intentos. Espera un rato y vuelve a intentar.' };
  }

  const { count: dayCount } = await client
    .from('api_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('ip_hash', ipHash)
    .gte('created_at', dayAgo);

  if ((dayCount ?? 0) >= perDay) {
    return { ok: false, retryAfter: 86400, reason: 'Llegaste al límite del día. Escríbenos directo: miguel@mcdesignspr.com' };
  }

  await client.from('api_rate_limits').insert({ bucket, ip_hash: ipHash });
  return { ok: true };
}
