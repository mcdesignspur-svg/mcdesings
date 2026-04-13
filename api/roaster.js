import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  // Normalize URL
  let targetUrl;
  try {
    targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'URL inválida. Ejemplo: tutienda.com' });
  }

  // Fetch webpage content
  let pageContent;
  let pageTitle = targetUrl.hostname;
  try {
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MCDesigns-WebRoaster/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    pageContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4500);
  } catch {
    return res.status(422).json({ error: 'No se pudo acceder a esa URL. ¿Está activa y pública?' });
  }

  // Claude analysis
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Eres un experto en diseño web, UX, y conversión digital con años de experiencia en negocios latinoamericanos.
Tu análisis es directo, honesto, y útil — no suavizas los problemas, pero tampoco eres cruel.
Tu objetivo es ayudar al dueño del negocio a entender exactamente qué está frenando su presencia online.
SIEMPRE responde en español de Puerto Rico — natural, claro, y sin tecnicismos innecesarios.`,
      messages: [
        {
          role: 'user',
          content: `Analiza esta página web y dame un diagnóstico honesto.

URL: ${targetUrl.toString()}
Título: ${pageTitle}

Contenido extraído de la página:
---
${pageContent}
---

Responde ÚNICAMENTE en formato JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "score": [número entero del 1 al 10],
  "verdict": "[Una sola oración directa y memorable que capture el estado de la web. Máx 15 palabras.]",
  "problemas": [
    "[Problema específico 1 — sé concreto, menciona qué falta o qué está mal]",
    "[Problema específico 2]",
    "[Problema específico 3]"
  ],
  "mejoras": [
    "[Mejora concreta 1 — acción específica que puede tomar]",
    "[Mejora concreta 2]",
    "[Mejora concreta 3]"
  ]
}`,
        },
      ],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Formato de respuesta inesperado');

    const analysis = JSON.parse(jsonMatch[0]);

    if (
      typeof analysis.score !== 'number' ||
      !analysis.verdict ||
      !Array.isArray(analysis.problemas) ||
      !Array.isArray(analysis.mejoras)
    ) {
      throw new Error('Estructura inválida');
    }

    const result = { ...analysis, domain: targetUrl.hostname, title: pageTitle };

    // Log to Supabase (fire and forget)
    logDemo('roaster', targetUrl.toString(), result, { domain: targetUrl.hostname });

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: 'Error al analizar. Intenta de nuevo en un momento.' });
  }
}
