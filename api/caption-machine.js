import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { descripcion, industria } = req.body;

  if (!descripcion || descripcion.trim().length < 5) {
    return res.status(400).json({ error: 'Describe tu producto o servicio para continuar.' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `Eres un experto en marketing digital para negocios en Puerto Rico.
Escribes captions de Instagram que suenan auténticos — en español puertorriqueño con spanglish natural, como habla la gente de verdad.
No escribes corporativo. No usas frases de template genéricas.
Cada caption tiene 3-5 oraciones, termina con 4-6 hashtags relevantes, y tiene un call-to-action claro.
Usas emojis con moderación — uno o dos, solo cuando añaden, no para decorar.`,
      messages: [
        {
          role: 'user',
          content: `Genera 3 captions de Instagram para este negocio/producto:

Descripción: ${descripcion.trim()}${industria ? `\nIndustria: ${industria}` : ''}

Escribe 3 versiones — cada una con un tono distinto:
1. PROFESIONAL: Confiable, experto, enfocado en valor y resultados
2. DIVERTIDO: Relajado, con personalidad, relatable — sin perder la esencia del negocio
3. EMOCIONAL: Conecta con la aspiración o el problema del cliente, crea conexión real

Responde ÚNICAMENTE en formato JSON válido (sin markdown, sin texto extra):
{
  "profesional": "[caption completo con emojis y hashtags]",
  "divertido": "[caption completo con emojis y hashtags]",
  "emocional": "[caption completo con emojis y hashtags]"
}`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Formato inesperado');

    const captions = JSON.parse(jsonMatch[0]);

    if (!captions.profesional || !captions.divertido || !captions.emocional) {
      throw new Error('Estructura inválida');
    }

    await logDemo('caption-machine', descripcion.trim(), captions, { industria: industria || null });

    return res.status(200).json(captions);
  } catch {
    return res.status(500).json({ error: 'Error al generar. Intenta de nuevo.' });
  }
}
