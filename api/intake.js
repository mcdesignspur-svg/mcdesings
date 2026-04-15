export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mcdesignspr.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    businessName,
    contactName,
    phone,
    email,
    service,
    businessDescription,
    targetAudience,
    mainProblem,
    referenceLinks,
    hasLogo,
    hasPhotos,
    timeline,
    referralSource,
  } = req.body;

  if (!businessName || !contactName || !phone || !email || !service) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const PROSPECTS_PAGE_ID = '335c9acc-9abd-81b5-8e89-ee1fdd79fd5a';

  if (!NOTION_API_KEY) {
    return res.status(500).json({ error: 'Notion API key not configured.' });
  }

  const notionBody = {
    parent: { page_id: PROSPECTS_PAGE_ID },
    icon: { type: 'emoji', emoji: '📋' },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: `${businessName} — Intake` } }],
      },
    },
    children: [
      paragraph(`📅 Recibido: ${new Date().toLocaleDateString('es-PR', { timeZone: 'America/Puerto_Rico', year: 'numeric', month: 'long', day: 'numeric' })}`),
      divider(),
      heading('📋 DATOS DEL CLIENTE'),
      paragraph(`Negocio: ${businessName}`),
      paragraph(`Contacto: ${contactName}`),
      paragraph(`Teléfono: ${phone}`),
      paragraph(`Email: ${email}`),
      paragraph(`Servicio de interés: ${service}`),
      divider(),
      heading('🏪 SOBRE EL NEGOCIO'),
      paragraph(`¿Qué hace el negocio?\n${businessDescription || '—'}`),
      paragraph(`Público objetivo:\n${targetAudience || '—'}`),
      paragraph(`Problema principal:\n${mainProblem || '—'}`),
      divider(),
      heading('📁 ASSETS & REFERENCIAS'),
      paragraph(`¿Tiene logo? ${hasLogo === 'yes' ? '✅ Sí' : '❌ No'}`),
      paragraph(`¿Tiene fotos? ${hasPhotos === 'yes' ? '✅ Sí' : '❌ No'}`),
      paragraph(`Links de referencia:\n${referenceLinks || '—'}`),
      divider(),
      heading('📆 LOGÍSTICA'),
      paragraph(`Timeline ideal: ${timeline || '—'}`),
      paragraph(`¿Cómo nos encontró? ${referralSource || '—'}`),
      divider(),
      paragraph('⬜ Propuesta enviada  ⬜ Contrato firmado  ⬜ Depósito recibido'),
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
      const err = await response.json();
      console.error('Notion error:', err);
      return res.status(500).json({ error: 'Error creando página en Notion.' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
}

function paragraph(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function heading(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}
