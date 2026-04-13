import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { negocio, dolor, meta } = req.body;

  if (!negocio || !dolor || !meta) {
    return res.status(400).json({ error: 'Faltan respuestas del quiz.' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Eres un consultor de integración de IA especializado en negocios en Puerto Rico.
Das recomendaciones concretas, específicas, y accionables — no genéricas.
Conoces bien las herramientas: Claude AI, ChatGPT, N8N, Supabase, WhatsApp Business API, Make, Zapier, Shopify AI, etc.
Siempre hablas en términos de impacto real para el negocio: tiempo ahorrado, ventas ganadas, clientes atendidos.
Responde en español de Puerto Rico — directo y claro.`,
      messages: [
        {
          role: 'user',
          content: `Un dueño de negocio respondió este quiz:

1. ¿Qué tipo de negocio tienes? → ${negocio}
2. ¿Cuál es tu mayor dolor de cabeza? → ${dolor}
3. ¿Cuál es tu meta principal? → ${meta}

Basado en esto, dame una recomendación personalizada de integración de IA.

Responde ÚNICAMENTE en formato JSON válido (sin markdown, sin texto extra):
{
  "solucion": "[Nombre corto de la solución — ej: Chatbot de Atención al Cliente]",
  "descripcion": "[2-3 oraciones explicando qué es y cómo resuelve su problema específico]",
  "impacto": "[El beneficio principal en términos concretos — tiempo, dinero, o ventas. Sé específico.]",
  "herramientas": ["[herramienta 1]", "[herramienta 2]", "[herramienta 3]"],
  "siguiente_paso": "[La acción más concreta que pueden tomar esta semana para empezar. Una sola oración.]"
}`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Formato inesperado');

    const resultado = JSON.parse(jsonMatch[0]);

    if (!resultado.solucion || !resultado.descripcion || !resultado.impacto) {
      throw new Error('Estructura inválida');
    }

    return res.status(200).json(resultado);
  } catch {
    return res.status(500).json({ error: 'Error al generar tu recomendación. Intenta de nuevo.' });
  }
}
