import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

// Allow up to 4mb body for base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, fileName } = req.body;

  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Imagen requerida' });
  }

  // Validate media type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(mediaType)) {
    return res.status(400).json({ error: 'Formato no soportado. Usa JPG, PNG, o WebP.' });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Eres un experto en branding, identidad visual, y posicionamiento de marca con amplia experiencia en negocios latinoamericanos y puertorriqueños.
Analizas logos e identidades visuales con ojo clínico — ves lo que comunican, a quién atraen, y qué está funcionando o no.
SIEMPRE responde en español de Puerto Rico — natural, directo, y sin tecnicismos innecesarios.
Sé específico y útil, no genérico.`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analiza este logo/imagen de marca y dame un diagnóstico honesto de lo que comunica.

Responde ÚNICAMENTE en formato JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "personalidad": ["[adjetivo 1]", "[adjetivo 2]", "[adjetivo 3]"],
  "comunica": "[Qué transmite esta marca a primera vista — en 1-2 oraciones directas]",
  "cliente_ideal": "[Descripción del cliente que esta marca atrae — sé específico]",
  "fortalezas": [
    "[Fortaleza visual o conceptual 1]",
    "[Fortaleza visual o conceptual 2]"
  ],
  "gaps": [
    "[Problema o inconsistencia 1 — sé concreto]",
    "[Problema o inconsistencia 2]"
  ],
  "recomendacion": "[La recomendación más importante para fortalecer esta marca — una sola, concreta y accionable]"
}`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Formato de respuesta inesperado');

    const analysis = JSON.parse(jsonMatch[0]);

    if (
      !Array.isArray(analysis.personalidad) ||
      !analysis.comunica ||
      !analysis.cliente_ideal ||
      !Array.isArray(analysis.fortalezas) ||
      !Array.isArray(analysis.gaps) ||
      !analysis.recomendacion
    ) {
      throw new Error('Estructura inválida');
    }

    // Log to Supabase (fire and forget — don't store image base64)
    logDemo('brand-analyzer', fileName || 'logo-upload', analysis, { mediaType });

    return res.status(200).json(analysis);
  } catch {
    return res.status(500).json({ error: 'Error al analizar. Intenta de nuevo.' });
  }
}
