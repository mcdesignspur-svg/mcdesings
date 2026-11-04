// Cuestionarios de descubrimiento para propuestas (ej. /siovera).
// Guarda las respuestas como página en Notion (Prospectos) y avisa por correo.
import { checkRateLimit } from './lib/rate-limit.js';

const PROSPECTS_PAGE_ID = '335c9acc-9abd-81b5-8e89-ee1fdd79fd5a';
const NOTIFY_TO = 'miguel@mcdesignspr.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Formularios permitidos y su ruta pública.
const FORMS = {
  siovera: { name: 'Siovera Distributors', path: '/siovera', emoji: '📦' },
};

const MAX_SECTIONS = 20;
const MAX_ITEMS = 40;
const MAX_Q = 300;
const MAX_A = 1900; // Notion limita cada texto a 2000 caracteres.
const NOTION_BATCH = 90;

function clip(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).slice(0, max).trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function richText(content, bold = false) {
  return { type: 'text', text: { content }, annotations: bold ? { bold: true } : undefined };
}

function paragraph(parts) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: parts } };
}

function heading(text) {
  return { object: 'block', type: 'heading_3', heading_3: { rich_text: [richText(text)] } };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

export function sanitize(body) {
  const contact = body.contact || {};
  const fields = {
    contactName: clip(contact.contactName, 200),
    businessName: clip(contact.businessName, 200),
    phone: clip(contact.phone, 40),
    email: clip(contact.email, 200),
    budget: clip(contact.budget, 80),
    timeline: clip(contact.timeline, 80),
  };
  const sections = (Array.isArray(body.sections) ? body.sections : [])
    .slice(0, MAX_SECTIONS)
    .map((s) => ({
      title: clip(s && s.title, 120) || 'Sección',
      items: (Array.isArray(s && s.items) ? s.items : [])
        .slice(0, MAX_ITEMS)
        .map((it) => ({ q: clip(it && it.q, MAX_Q), a: clip(it && it.a, MAX_A) }))
        .filter((it) => it.q),
    }));
  return { fields, sections };
}

export function buildBlocks(form, fields, sections) {
  const answered = sections.reduce((n, s) => n + s.items.filter((i) => i.a).length, 0);
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const blocks = [
    paragraph([richText(`📅 Recibido: ${new Date().toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico', dateStyle: 'long', timeStyle: 'short' })} (vía ${form.path})`)]),
    paragraph([richText(`✍️ Contestó ${answered} de ${total} preguntas`)]),
    divider(),
  ];
  sections.forEach((s) => {
    blocks.push(heading(s.title));
    s.items.forEach((it) => {
      blocks.push(paragraph([richText(`${it.q}\n`, true), richText(it.a || '—')]));
    });
  });
  blocks.push(divider());
  blocks.push(paragraph([richText('⬜ Propuesta enviada  ⬜ Contrato firmado  ⬜ Depósito recibido')]));
  return blocks;
}

function buildEmail(form, fields, sections, notionUrl) {
  const rows = sections
    .map((s) => {
      const items = s.items
        .filter((it) => it.a)
        .map(
          (it) => `
          <div style="margin:0 0 12px;">
            <div style="color:#6b7280;font-size:12px;margin-bottom:2px;">${escapeHtml(it.q)}</div>
            <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(it.a)}</div>
          </div>`,
        )
        .join('');
      if (!items) return '';
      return `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
          <div style="color:#0056c6;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:10px;font-weight:700;">${escapeHtml(s.title)}</div>
          ${items}
        </div>`;
    })
    .join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;color:#1a1c1c;">
      <div style="background:#0056c6;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:6px;">Cuestionario completado · ${escapeHtml(form.path)}</div>
        <div style="font-size:22px;font-weight:700;">${escapeHtml(fields.businessName || form.name)}</div>
        <div style="font-size:14px;opacity:0.9;margin-top:2px;">${escapeHtml(fields.contactName)} · ${escapeHtml(fields.phone)} · ${escapeHtml(fields.email)}</div>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
        <div style="font-size:14px;">Presupuesto: <strong>${escapeHtml(fields.budget || '—')}</strong> · Tiempo: <strong>${escapeHtml(fields.timeline || '—')}</strong></div>
        ${notionUrl ? `<div style="margin-top:10px;font-size:14px;"><a href="${escapeHtml(notionUrl)}" style="color:#0056c6;">Abrir en Notion</a></div>` : ''}
        ${rows}
      </div>
    </div>`;
}

async function notify(form, fields, sections, notionUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MC Designs <hello@mcdesignspr.com>',
        to: [NOTIFY_TO],
        reply_to: fields.email,
        subject: `📋 CUESTIONARIO · ${fields.businessName || form.name} · ${fields.contactName}`,
        html: buildEmail(form, fields, sections, notionUrl),
      }),
    });
    if (!r.ok) console.error('[descubrimiento:notify] Resend', r.status);
    return r.ok;
  } catch (err) {
    console.error('[descubrimiento:notify] failed:', err?.message);
    return false;
  }
}

async function notion(path, method, payload, key) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Notion ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mcdesignspr.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, 'descubrimiento', { perHour: 5, perDay: 15 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: rl.reason });
  }

  const body = req.body || {};

  // Honeypot: éxito silencioso.
  if (body.website) return res.status(200).json({ success: true });

  const form = FORMS[body.formId];
  if (!form) return res.status(400).json({ error: 'Formulario desconocido.' });

  const { fields, sections } = sanitize(body);
  if (!fields.contactName || !fields.phone || !fields.email) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }
  if (!EMAIL_RE.test(fields.email)) return res.status(400).json({ error: 'Email inválido.' });

  const key = process.env.NOTION_API_KEY;
  if (!key) return res.status(500).json({ error: 'Notion API key not configured.' });

  const blocks = buildBlocks(form, fields, sections);

  try {
    const page = await notion(
      'pages',
      'POST',
      {
        parent: { page_id: PROSPECTS_PAGE_ID },
        icon: { type: 'emoji', emoji: form.emoji },
        properties: {
          title: {
            title: [{ type: 'text', text: { content: `📋 ${fields.businessName || form.name} — Cuestionario de requisitos` } }],
          },
        },
        children: blocks.slice(0, NOTION_BATCH),
      },
      key,
    );

    // Notion acepta máximo 100 bloques por llamada; el resto se agrega por partes.
    for (let i = NOTION_BATCH; i < blocks.length; i += NOTION_BATCH) {
      await notion(`blocks/${page.id}/children`, 'PATCH', { children: blocks.slice(i, i + NOTION_BATCH) }, key);
    }

    await notify(form, fields, sections, page.url);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[descubrimiento] error:', err?.message, err?.details);
    // Si Notion falla, el correo lleva todas las respuestas; si salió, no se pierde nada.
    const mailed = await notify(form, fields, sections, null);
    if (mailed) return res.status(200).json({ success: true, stored: 'email' });
    return res.status(500).json({ error: 'Error guardando las respuestas.' });
  }
}
