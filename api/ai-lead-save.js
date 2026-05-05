import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './lib/rate-limit.js';

const FIELD_LIMITS = {
  nombre: 200,
  email: 200,
  telefono: 40,
  negocio: 500,
  dolor: 2000,
  meta: 2000,
  fuente: 100,
};

const RESULT_FIELD_LIMITS = {
  solucion: 2000,
  descripcion: 5000,
  impacto: 2000,
  herramientas: 2000,
  siguiente_paso: 2000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clip(value, max) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).slice(0, max).trim();
  return trimmed || null;
}

function clipResult(result) {
  if (!result || typeof result !== 'object') return {};
  return Object.fromEntries(
    Object.entries(RESULT_FIELD_LIMITS).map(([k, max]) => [k, clip(result[k], max)]),
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mcdesignspr.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit — this endpoint writes to ai_leads + fires N8N webhook on each call.
  const rl = await checkRateLimit(req, 'ai-lead-save', { perHour: 5, perDay: 20 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: rl.reason });
  }

  const body = req.body || {};

  // Honeypot.
  if (body.website || body.url_field) {
    return res.status(200).json({ saved: true });
  }

  const negocio = clip(body.negocio, FIELD_LIMITS.negocio);
  const dolor = clip(body.dolor, FIELD_LIMITS.dolor);
  const meta = clip(body.meta, FIELD_LIMITS.meta);
  const resultado = clipResult(body.resultado);

  if (!negocio || !dolor || !meta || !body.resultado) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  const nombre = clip(body.nombre, FIELD_LIMITS.nombre);
  const email = clip(body.email, FIELD_LIMITS.email)?.toLowerCase() ?? null;
  const telefono = clip(body.telefono, FIELD_LIMITS.telefono);
  const fuente = clip(body.fuente, FIELD_LIMITS.fuente) || 'homepage';

  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  // Prefer service role — required after migration 003 enables RLS.
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[ai-lead-save] Supabase env vars missing');
    return res.status(200).json({ saved: false });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    const { error } = await supabase.from('ai_leads').insert({
      nombre,
      email,
      telefono,
      negocio,
      dolor,
      meta,
      solucion: resultado.solucion,
      descripcion: resultado.descripcion,
      impacto: resultado.impacto,
      herramientas: resultado.herramientas,
      siguiente_paso: resultado.siguiente_paso,
      fuente,
      contactado: false,
    });

    if (error) throw error;

    // Fire N8N webhook (non-blocking).
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, telefono, negocio, dolor, meta, resultado, fuente }),
      }).catch((err) => console.error('[ai-lead-save] N8N webhook error:', err?.message));
    }

    return res.status(200).json({ saved: true });
  } catch (err) {
    console.error('[ai-lead-save] Error:', err?.message);
    return res.status(200).json({ saved: false });
  }
}
