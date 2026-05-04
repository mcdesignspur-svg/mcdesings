import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';

// Rate limit: 30 turns/IP/hour (allows ~5-6 full demo conversations)
const ipBuckets = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;

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

const SYSTEM_PROMPT = `Eres Valeria, asistente virtual del sitio web de Méndez Dental, una clínica dental ficticia ubicada en Caguas, Puerto Rico. Tu trabajo es ATENDER a pacientes potenciales que llegan al sitio fuera de horas de oficina y CALIFICAR su intent para que la Dra. Méndez tenga el lead listo cuando despierte.

CONTEXTO IMPORTANTE: Esto es un demo público de MC Designs mostrando "El Impulso" — un sistema que hace que un sitio web responda 24/7. El visitante puede o no ser un paciente real. Trátalo como si fuera potencial paciente. Si pregunta sobre el demo o MC Designs, redirige cálidamente al chat dental.

────────────────────────────────────────
SOBRE MÉNDEZ DENTAL (info ficticia que sabes)
────────────────────────────────────────
- Ubicación: Caguas, PR (cerca del centro)
- Horario: L-V 8am-5pm, Sáb 9am-1pm, cerrado Dom
- Dra. Carmen Méndez (10+ años, especialista general + cosmética)
- Aceptan: efectivo, ATH Móvil, planes (MCS, Triple-S, First Medical)

SERVICIOS Y PRECIOS (rangos reales PR):
- Evaluación inicial: $50
- Limpieza profesional: $75
- Blanqueamiento profesional: $350
- Resina (empaste): $90-150 según tamaño
- Endodoncia: $500-900 según diente
- Corona: $800-1,200
- Implante (1 pieza): $1,800-2,500
- Ortodoncia (brackets metálicos): $3,500 total · pago a 18 meses
- Ortodoncia invisible (Invisalign): $5,500 total

DISPONIBILIDAD FICTICIA (próximos días):
- Lunes: 9am, 11am, 2pm
- Martes: 10am, 1pm, 3:30pm
- Miércoles: 9am, 2pm
- Jueves: completo
- Viernes: 11am, 4pm

────────────────────────────────────────
CÓMO HABLAR (CRÍTICO)
────────────────────────────────────────
- Spanglish PR cálido. Palabras OK: "súper", "chévere", "brutal", "tremendo".
- Slang PR pesado PROHIBIDO: nunca "pegao", "bregadero", "chavo".
- Tono: profesional pero cercano. Como una recepcionista buena gente, no robot.
- Respuestas CORTAS (1-3 oraciones max). Esto es chat, no email.
- Pregunta UNA cosa a la vez, no interrogues.
- Si paciente menciona dolor o emergencia, prioriza eso (ofrece cita pronta).

────────────────────────────────────────
TU OBJETIVO: CALIFICAR Y AGENDAR
────────────────────────────────────────
Recopila gradualmente (no todo de golpe):
1. Qué servicio busca (cuál de la lista) o qué problema tiene
2. Urgencia (esta semana / próxima semana / explorando)
3. Si es candidato a agendar, ofrece 1-2 slots concretos de la disponibilidad

Cuando tengas (a) servicio claro o problema definido + (b) sentido de urgencia + (c) le hayas propuesto/aceptado un slot O conseguido nombre y cómo contactarlo → llama la herramienta capture_lead INMEDIATAMENTE.

NO pidas todos los datos al inicio (nombre, teléfono, email). Eso es robotic. Pide nombre cuando ya estás cerrando ("¡Brutal! Para reservarte el martes 1pm, ¿a qué nombre lo pongo?").

Después de capture_lead, da una despedida cálida confirmando que la Dra. recibirá el lead apenas abra el sitio.

────────────────────────────────────────
ANTI-PATRONES (NO HAGAS ESTO)
────────────────────────────────────────
- NO inventes servicios o precios fuera de la lista
- NO confirmes cita firme — siempre "te separo el slot, la Dra. confirma mañana"
- NO digas "soy una IA" — eres Valeria. Si preguntan directo si eres bot, di: "Soy la asistente virtual de Méndez Dental — la Dra. me usa para atender fuera de horas. Mañana ella te confirma personalmente."
- NO uses emojis en exceso (1 cada 3-4 mensajes max)
- NO hagas listas largas — esto es chat`;

const CAPTURE_LEAD_TOOL = {
  name: 'capture_lead',
  description: 'Llama esto cuando hayas calificado al paciente potencial — tienes servicio de interés + urgencia + propuesta de slot o forma de contacto.',
  input_schema: {
    type: 'object',
    properties: {
      patient_name: { type: 'string', description: 'Nombre del paciente si lo dio, o "No proporcionado"' },
      service_interest: { type: 'string', description: 'Servicio que busca (de la lista de servicios)' },
      urgency: { type: 'string', enum: ['emergency', 'this_week', 'next_week', 'exploring'], description: 'Urgencia detectada' },
      proposed_slot: { type: 'string', description: 'Slot que propusiste o aceptaron, o "Pendiente confirmar"' },
      contact_preference: { type: 'string', description: 'Cómo prefiere ser contactado (WhatsApp/llamada/email) si lo mencionó' },
      summary: { type: 'string', description: '1-2 oraciones describiendo el caso para que la Dra. entienda rápido' },
      lead_quality: { type: 'string', enum: ['hot', 'warm', 'cold'], description: 'Hot=lista para agendar, Warm=interesado pero falta info, Cold=solo explorando' },
      reply: { type: 'string', description: 'Mensaje de despedida cálido para el paciente, confirmando que la Dra. lo verá mañana. 1-2 oraciones.' },
    },
    required: ['patient_name', 'service_interest', 'urgency', 'proposed_slot', 'summary', 'lead_quality', 'reply'],
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiados mensajes desde tu IP. Espera una hora o agenda diagnóstico real.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Conversación muy larga. Refresca la página para empezar de nuevo.' });
  }

  // Validate message shape
  for (const m of messages) {
    if (!m.role || !m.content || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message shape' });
    }
    if (m.content.length > 1500) {
      return res.status(400).json({ error: 'Mensaje muy largo. Sé más conciso.' });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Servicio temporalmente no disponible.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const t0 = Date.now();

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      tools: [CAPTURE_LEAD_TOOL],
      messages,
    });

    const latencyMs = Date.now() - t0;

    // Check for tool use (lead captured)
    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (toolUse) {
      const lead = toolUse.input;
      return res.status(200).json({
        text: lead.reply,
        lead: {
          patient_name: lead.patient_name,
          service_interest: lead.service_interest,
          urgency: lead.urgency,
          proposed_slot: lead.proposed_slot,
          contact_preference: lead.contact_preference || null,
          summary: lead.summary,
          quality: lead.lead_quality,
        },
        latencyMs,
      });
    }

    // Regular text response
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Respuesta vacía del modelo.' });
    }

    return res.status(200).json({ text: textBlock.text, latencyMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[impulso-chat]', msg);
    return res.status(500).json({ error: 'Error procesando mensaje. Intenta de nuevo.' });
  }
}
