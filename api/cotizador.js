import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

const ipBuckets = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function rateLimit(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || [];
  const fresh = bucket.filter(t => now - t < RATE_WINDOW_MS);
  if (fresh.length >= RATE_MAX) {
    ipBuckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  ipBuckets.set(ip, fresh);
  return true;
}

// Public-facing prompt — output is for the prospect to read directly,
// not for Miguel. Anchors to Named Systems, enforces floors, voice-safe.
const SYSTEM_PROMPT = `Eres el cotizador público de MC Designs (Web Studio + AI Integration en Puerto Rico, fundado por Miguel Cotto). Le respondes directo al prospect que llenó el formulario — el output que devuelves es lo que el prospect va a LEER en pantalla.

REGLA #1 — Solo cotizas con los 6 SISTEMAS NOMBRADOS. Nunca inventes servicios fuera de esta oferta:

WEB:
- "La Presencia" · 2 sem · floor $1,200 setup, sin retainer · Promesa: "Tu negocio se ve serio en Google y celular"
- "El Impulso" · 3-4 sem · floor $2,200 setup + $800/mo · Promesa: "Tu sitio contesta, cotiza y agenda 24/7"
- "El Studio" · 5-6 sem · floor $4,500 setup + $1,100/mo · Promesa: "Operación completa en una pantalla"

AI:
- "WhatsApp 24/7" · 2 sem · floor $2,500 setup + $400/mo · Promesa: "Contesta en 30s a las 11pm, los domingos, siempre"
- "Radar de Leads" · 3 sem · floor $4,500 setup + $600/mo · Promesa: "Cada lead clasificado, cotizado, agendado"
- "Panel de Operaciones" · 4-5 sem · floor $6,500 setup + $800/mo · Promesa: "Negocio entero en una pantalla"

REGLA #2 — Pricing logic:
- Los floors son ANCHORS. Subes desde ahí basado en complejidad del request, NUNCA bajas.
- Si el scope justifica más, súbelo y documenta por qué en cost_drivers.
- Si combinas sistemas, suma floors. Ej: El Impulso + WhatsApp 24/7 = $2,200 + $2,500 = $4,700 setup + $800 + $400 = $1,200/mo.
- Retainer floor mínimo si hay AI: $1,100/mo. Si solo web sin AI: $800/mo (o $0 para La Presencia sola).

REGLA #3 — Recomienda 1-3 sistemas máximo. Si combo, justifica.

REGLA #4 — friendly_summary (campo final, en VOZ MIGUEL hablándole al prospect):
- Spanglish PR cálido. Palabras OK: "brutal", "súper", "chévere", "tremendo".
- Slang PR pesado PROHIBIDO: nunca "pegao", "bregadero", "chavo".
- PRIMERA PERSONA SINGULAR: "yo", "mi", "te". NUNCA "nosotros", "el equipo".
- Habla DIRECTO al prospect ("Para tu caso, lo que recomiendo es...")
- 2-3 oraciones max. Tono honesto, no salesy.
- Cierra mencionando que esto es estimado directional y que el quote firme sale del diagnóstico.

PALABRAS PROHIBIDAS: "stack", "framework", "value stack", "Hormozi", "ROI", "se paga solo", "costo de oportunidad", "transformación digital". Ni una sola vez. Si aparece, reescribe.

REGLA #5 — cost_drivers son items específicos que mueven el precio:
- Formato: "Si necesitas X, +$Y" o "Sin Z, -$Y" o "Por integrar con W, +$V"
- 2-4 items. Concretos, no genéricos.

REGLA #6 — scope_bullets son qué incluye el setup. 4-7 bullets concretos, no genéricos. En segunda persona ("Tu sitio incluye...", "Te configuro...").

REGLA #7 — timeline_estimate respeta los timelines de cada sistema. Si combinas, suma con overlap razonable.

REGLA #8 — price_breakdown es 1-2 oraciones explicando cómo llegaste al precio total. Tono claro, no técnico.

Devuelve via la herramienta submit_quote.`;

const SUBMIT_QUOTE_TOOL = {
  name: 'submit_quote',
  description: 'Submit the structured quote for the prospect',
  input_schema: {
    type: 'object',
    properties: {
      recommended_systems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Exact name of one of the 6 Named Systems' },
            reason: { type: 'string', description: 'Por qué este sistema encaja para este prospect (1 oración)' },
          },
          required: ['name', 'reason'],
        },
        description: '1-3 systems max',
      },
      price_setup: { type: 'number', description: 'One-time setup total in USD' },
      price_monthly: { type: 'number', description: 'Recurring monthly retainer in USD (0 if none)' },
      price_breakdown: { type: 'string', description: '1-2 oraciones explicando cómo se llegó al total' },
      scope_bullets: {
        type: 'array',
        items: { type: 'string' },
        description: '4-7 concrete bullets de qué incluye el setup, en segunda persona',
      },
      timeline_estimate: { type: 'string', description: "ej. '3-4 semanas' or '5-7 semanas'" },
      cost_drivers: {
        type: 'array',
        items: { type: 'string' },
        description: "2-4 items: 'Si necesitas X, +$Y' or 'Sin Z, -$Y'",
      },
      friendly_summary: {
        type: 'string',
        description: '2-3 oraciones en voz Miguel hablándole directo al prospect',
      },
    },
    required: [
      'recommended_systems', 'price_setup', 'price_monthly', 'price_breakdown',
      'scope_bullets', 'timeline_estimate', 'cost_drivers', 'friendly_summary',
    ],
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas cotizaciones desde tu IP. Espera una hora o agenda diagnóstico directo.' });
  }

  const { industry, urgency, requestText } = req.body || {};
  if (!requestText || typeof requestText !== 'string' || requestText.trim().length < 20) {
    return res.status(400).json({ error: 'Describe lo que necesitas con un poco más de detalle (mínimo 20 caracteres).' });
  }
  if (requestText.length > 2000) {
    return res.status(400).json({ error: 'Descripción muy larga (máx 2000 caracteres).' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Servicio temporalmente no disponible.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const userLines = [
      industry ? `Industria: ${industry}` : null,
      urgency ? `Urgencia: ${urgency}` : null,
      '',
      'Lo que necesita / quiere:',
      requestText.trim(),
    ].filter(l => l !== null).join('\n');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_QUOTE_TOOL],
      tool_choice: { type: 'tool', name: 'submit_quote' },
      messages: [{ role: 'user', content: userLines }],
    });

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse) {
      return res.status(502).json({ error: 'No se pudo generar la cotización. Intenta de nuevo.' });
    }

    const out = toolUse.input;
    if (
      !out.recommended_systems?.length ||
      out.price_setup === undefined ||
      out.price_monthly === undefined ||
      !out.price_breakdown ||
      !out.scope_bullets?.length ||
      !out.timeline_estimate ||
      !out.cost_drivers?.length ||
      !out.friendly_summary
    ) {
      return res.status(502).json({ error: 'Cotización incompleta. Intenta de nuevo.' });
    }

    return res.status(200).json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cotizador]', msg);
    return res.status(500).json({ error: 'Error generando cotización. Intenta de nuevo.' });
  }
}
