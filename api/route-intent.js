import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit } from './lib/rate-limit.js';

const MODEL = 'claude-haiku-4-5';

const NAV_MAP = {
  'servicios':              { url: '/servicios',                    label: 'Servicios' },
  'portfolio':              { url: '/portfolio',                    label: 'Portfolio' },
  'lab':                    { url: '/lab',                          label: 'Demos AI' },
  'talk':                   { url: '/talk',                         label: 'Cuéntame qué necesitas' },
  'contacto':               { url: '/contacto',                     label: 'Agendar llamada' },
  'about':                  { url: '/about',                        label: 'Sobre Miguel' },
  'recursos':               { url: '/recursos',                     label: 'Recursos' },
  'intake':                 { url: '/intake',                       label: 'Form de intake' },
  'diseno-web-pr':          { url: '/diseno-web-puerto-rico',       label: 'Web Design PR' },
  'automatizacion-ia-pr':   { url: '/automatizacion-ia-puerto-rico', label: 'Automatización AI PR' },
  'shopify-pr':             { url: '/shopify-puerto-rico',          label: 'Shopify PR' },
  'demo-cotizador':         { url: '/demo-cotizador',               label: 'Demo · Cotizador' },
  'demo-chatbot':           { url: '/demo-chatbot',                 label: 'Demo · Chatbot' },
  'demo-ocr':               { url: '/demo-ocr',                     label: 'Demo · OCR Facturas' },
  'demo-brand':             { url: '/demo-brand',                   label: 'Demo · Brand Analyzer' },
  'demo-captions':          { url: '/demo-captions',                label: 'Demo · Caption Machine' },
  'demo-panel':             { url: '/demo-panel',                   label: 'Demo · Panel de Operaciones' },
  'demo-roaster':           { url: '/demo-roaster',                 label: 'Demo · Website Roaster' },
  'demo-impulso':           { url: '/demo-impulso',                 label: 'Demo · El Impulso' },
};

const SYSTEM_PROMPT = `Eres el router de mcdesignspr.com (MC Designs · web + AI integration en Puerto Rico).

Tu trabajo: clasificar lo que el visitante escribió en una sola acción.

# Cuándo usar route_to
Si el visitante muestra intención CLARA de ver una página o sección específica:
- "muéstrame portfolio", "ver portfolio", "tu trabajo" → portfolio
- "servicios", "precios", "cuánto cuesta", "tiers" → servicios
- "demos AI", "demos de AI", "ejemplos AI", "ver demos" → lab
- "agenda llamada", "agendar", "calendario", "reunirnos" → talk (form qualifying)
- "agendar directo en cal.com", "calendario directo" → contacto
- "sobre Miguel", "quién eres", "about" → about
- "recursos", "blog", "artículos", "guías" → recursos
- "diseño web puerto rico" → diseno-web-pr
- "automatización AI puerto rico" → automatizacion-ia-pr
- "shopify puerto rico", "tienda online" → shopify-pr
- "demo cotizador" → demo-cotizador
- "demo chatbot" → demo-chatbot
- "demo OCR", "OCR facturas" → demo-ocr
- "demo brand analyzer" → demo-brand
- "demo captions", "generador captions" → demo-captions
- "demo panel", "panel de operaciones" → demo-panel
- "demo roaster", "roastear" → demo-roaster
- Si dicen un servicio + precio juntos ("¿precios web?"), prefiere servicios.

# Cuándo NO llamar route_to (responder con texto vacío)
Si el visitante hace una PREGUNTA exploratoria que requiere conversación:
- "¿qué hacen?", "¿qué construyen?"
- "¿cómo trabajas?", "¿cómo es trabajar contigo?"
- "¿AI integration es para mi negocio?", "¿esto sirve para mi caso?"
- Cualquier pregunta abierta que merece respuesta detallada
- "hola", saludos, conversación informal

En estos casos NO uses route_to — el sistema redirige al chat /ask-mc automáticamente.

# Reglas
- Solo llama route_to UNA vez si la intención es clara.
- Si dudas entre navegar o conversar, NO llames route_to (mejor pasar al chat).
- Inglés también funciona ("show me portfolio", "what do you do?").`;

const TOOLS = [
  {
    name: 'route_to',
    description: 'Llamar SOLO cuando el visitante muestra intención CLARA de ver una página específica. Si la query es exploratoria/conversacional, NO uses esta tool.',
    input_schema: {
      type: 'object',
      required: ['destination'],
      properties: {
        destination: {
          type: 'string',
          enum: Object.keys(NAV_MAP),
        },
      },
    },
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://mcdesignspr.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await checkRateLimit(req, 'route-intent', { perHour: 60, perDay: 200 });
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: rl.reason, action: 'chat' });
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query required' });
  }
  const trimmed = query.slice(0, 500).trim();
  if (!trimmed) return res.status(400).json({ error: 'query required' });

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages: [{ role: 'user', content: trimmed }],
    });

    const toolUse = msg.content.find((b) => b.type === 'tool_use');
    if (toolUse?.name === 'route_to' && toolUse.input?.destination) {
      const dest = NAV_MAP[toolUse.input.destination];
      if (dest) {
        return res.status(200).json({
          action: 'navigate',
          url: dest.url,
          label: dest.label,
          destination: toolUse.input.destination,
        });
      }
    }

    return res.status(200).json({ action: 'chat' });
  } catch (err) {
    console.error('[route-intent] error:', err?.message);
    // Fail open to chat — better UX than 500.
    return res.status(200).json({ action: 'chat', error: err?.message });
  }
}
