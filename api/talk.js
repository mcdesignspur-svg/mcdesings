import { checkRateLimit } from './lib/rate-limit.js';

const FIELD_LIMITS = {
  service: 200,
  budget: 80,
  timeline: 80,
  contactName: 200,
  businessName: 200,
  email: 200,
  whatsapp: 40,
  message: 5000,
  referralSource: 200,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROSPECTS_PAGE_ID = '335c9acc-9abd-81b5-8e89-ee1fdd79fd5a';

function clip(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).slice(0, max);
}

function paragraph(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}

function heading(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [{ type: 'text', text: { content: text } }] },
  };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function isQualified(fields) {
  const seriousBudget = ['$3K – $8K', '$8K – $15K', '$15K +'].includes(fields.budget);
  const urgentTimeline = ['Lo antes posible · ASAP', '1 – 3 meses'].includes(fields.timeline);
  return seriousBudget || urgentTimeline;
}

async function notifyMiguel(fields, qualified) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const tag = qualified ? '🟢 HOT' : '🟡 EXPLORANDO';
  const subject = `${tag} · ${fields.contactName}${fields.businessName ? ` (${fields.businessName})` : ''} · ${fields.service}`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1c1c;">
      <div style="background:#0056c6;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:6px;">Nuevo lead · /talk</div>
        <div style="font-size:22px;font-weight:700;">${tag} · ${escapeHtml(fields.contactName)}</div>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:130px;">Negocio</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.businessName || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;font-weight:600;"><a href="mailto:${escapeHtml(fields.email)}" style="color:#0056c6;">${escapeHtml(fields.email)}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">WhatsApp</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.whatsapp || '—')}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Servicio</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.service)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Presupuesto</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.budget)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Timeline</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.timeline)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Source</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(fields.referralSource || '—')}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
          <div style="color:#6b7280;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;">Lo que quiere lograr</div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(fields.message)}</div>
        </div>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MC Designs <hello@mcdesignspr.com>',
        to: ['miguel@mcdesignspr.com'],
        reply_to: fields.email,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[talk:notifyMiguel] failed:', err?.message);
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mcdesignspr.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, 'talk', { perHour: 5, perDay: 15 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: rl.reason });
  }

  const body = req.body || {};

  // Honeypot — silent success.
  if (body.website || body.url_field) {
    return res.status(200).json({ success: true });
  }

  const fields = Object.fromEntries(
    Object.entries(FIELD_LIMITS).map(([k, max]) => [k, clip(body[k], max).trim()]),
  );

  if (!fields.service || !fields.budget || !fields.timeline) {
    return res.status(400).json({ error: 'Faltan respuestas requeridas.' });
  }
  if (!fields.contactName || !fields.email || !fields.message) {
    return res.status(400).json({ error: 'Faltan datos de contacto.' });
  }
  if (!EMAIL_RE.test(fields.email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!NOTION_API_KEY) {
    return res.status(500).json({ error: 'Notion API key not configured.' });
  }

  const qualified = isQualified(fields);
  const tag = qualified ? '🟢 HOT' : '🟡 EXPLORANDO';
  const titleSuffix = fields.businessName ? ` · ${fields.businessName}` : '';

  const notionBody = {
    parent: { page_id: PROSPECTS_PAGE_ID },
    icon: { type: 'emoji', emoji: '💬' },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: `${tag} · ${fields.contactName}${titleSuffix}` } }],
      },
    },
    children: [
      paragraph(`📅 Recibido: ${new Date().toLocaleDateString('es-PR', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: 'long', day: 'numeric' })} (vía /talk)`),
      paragraph(`🏷️ Estado: ${qualified ? 'HOT — pasa qualifying (presupuesto serio o timeline urgente)' : 'EXPLORANDO — pre-qualifying, contactar igual'}`),
      divider(),
      heading('👤 CONTACTO'),
      paragraph(`Nombre: ${fields.contactName}`),
      paragraph(`Negocio: ${fields.businessName || '—'}`),
      paragraph(`Email: ${fields.email}`),
      paragraph(`WhatsApp: ${fields.whatsapp || '—'}`),
      divider(),
      heading('🎯 PROYECTO'),
      paragraph(`Servicio: ${fields.service}`),
      paragraph(`Presupuesto: ${fields.budget}`),
      paragraph(`Timeline: ${fields.timeline}`),
      divider(),
      heading('💭 LO QUE QUIERE LOGRAR'),
      paragraph(fields.message),
      divider(),
      heading('📍 SOURCE'),
      paragraph(`¿Cómo me encontró? ${fields.referralSource || '—'}`),
      divider(),
      paragraph('⬜ Respondido en 24h  ⬜ Llamada agendada  ⬜ Propuesta enviada  ⬜ Cerrado'),
    ],
  };

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(notionBody),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[talk] Notion error:', err);
      return res.status(500).json({ error: 'Error guardando en Notion.' });
    }

    // Email notification — fire-and-forget, doesn't block success.
    notifyMiguel(fields, qualified).catch((err) => console.error('[talk] notify failed:', err?.message));

    return res.status(200).json({ success: true, qualified });
  } catch (err) {
    console.error('[talk] server error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
