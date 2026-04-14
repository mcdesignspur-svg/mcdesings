import { logDemo } from './lib/supabase.js';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, email, telefono, negocio, dolor, meta, resultado, fuente } = req.body;

  if (!negocio || !dolor || !meta || !resultado) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  // Only validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Still return success so the user sees their result
    console.error('[ai-lead-save] Supabase env vars missing');
    return res.status(200).json({ saved: false });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('ai_leads').insert({
      nombre: nombre?.trim() || null,
      email: email?.trim().toLowerCase() || null,
      telefono: telefono?.trim() || null,
      negocio,
      dolor,
      meta,
      solucion: resultado.solucion || null,
      descripcion: resultado.descripcion || null,
      impacto: resultado.impacto || null,
      herramientas: resultado.herramientas || null,
      siguiente_paso: resultado.siguiente_paso || null,
      fuente: fuente || 'homepage',
      contactado: false,
    });

    if (error) throw error;

    // Fire N8N webhook (non-blocking — don't fail lead save if this errors)
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
    // Don't fail the user experience over a DB error
    return res.status(200).json({ saved: false });
  }
}
