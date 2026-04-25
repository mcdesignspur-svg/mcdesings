import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { negocio, dolor, meta, lang = 'es' } = req.body;
  const isEnglish = lang === 'en';

  if (!negocio || !dolor || !meta) {
    return res.status(400).json({ error: isEnglish ? 'Missing quiz answers.' : 'Faltan respuestas del quiz.' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: isEnglish ? `You are an AI integration consultant specialized in Puerto Rico businesses.
Give concrete, specific, actionable recommendations, never generic ones.
You know tools like Claude AI, ChatGPT, N8N, Supabase, WhatsApp Business API, Make, Zapier, Shopify AI, and similar.
Always speak in terms of real business impact: time saved, sales gained, customers served.
Respond in clear, direct English.` : `Eres un consultor de integración de IA especializado en negocios en Puerto Rico.
Das recomendaciones concretas, específicas, y accionables — no genéricas.
Conoces bien las herramientas: Claude AI, ChatGPT, N8N, Supabase, WhatsApp Business API, Make, Zapier, Shopify AI, etc.
Siempre hablas en términos de impacto real para el negocio: tiempo ahorrado, ventas ganadas, clientes atendidos.
Responde en español de Puerto Rico — directo y claro.`,
      messages: [
        {
          role: 'user',
          content: isEnglish ? `A business owner answered this quiz:

1. What type of business do you run? → ${negocio}
2. What takes the most time right now? → ${dolor}
3. What is your main goal? → ${meta}

Based on this, give a personalized AI integration recommendation.

Respond ONLY in valid JSON format (no markdown, no extra text):
{
  "solucion": "[Short solution name — ex: Customer Service Chatbot]",
  "descripcion": "[2-3 sentences explaining what it is and how it solves their specific problem]",
  "impacto": "[Main benefit in concrete terms — time, money, or sales. Be specific.]",
  "herramientas": ["[tool 1]", "[tool 2]", "[tool 3]"],
  "siguiente_paso": "[The most concrete action they can take this week to start. One sentence.]"
}` : `Un dueño de negocio respondió este quiz:

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
    return res.status(500).json({ error: isEnglish ? 'Error generating your recommendation. Try again.' : 'Error al generar tu recomendación. Intenta de nuevo.' });
  }
}
