import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, lang = 'es' } = req.body;
  const isEnglish = lang === 'en';
  if (!url) return res.status(400).json({ error: isEnglish ? 'URL required' : 'URL requerida' });

  // Normalize URL
  let targetUrl;
  try {
    targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: isEnglish ? 'Invalid URL. Example: yourstore.com' : 'URL inválida. Ejemplo: tutienda.com' });
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
    return res.status(422).json({ error: isEnglish ? 'Could not access that URL. Is it live and public?' : 'No se pudo acceder a esa URL. ¿Está activa y pública?' });
  }

  // Claude analysis
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: isEnglish ? `You are an expert in web design, UX, and digital conversion with years of experience helping local businesses.
Your analysis is direct, honest, and useful. You do not soften problems, but you are not cruel.
Your goal is to help the business owner understand exactly what is slowing down their online presence.
ALWAYS respond in clear, natural English without unnecessary jargon.` : `Eres un experto en diseño web, UX, y conversión digital con años de experiencia en negocios latinoamericanos.
Tu análisis es directo, honesto, y útil — no suavizas los problemas, pero tampoco eres cruel.
Tu objetivo es ayudar al dueño del negocio a entender exactamente qué está frenando su presencia online.
SIEMPRE responde en español de Puerto Rico — natural, claro, y sin tecnicismos innecesarios.`,
      messages: [
        {
          role: 'user',
          content: isEnglish ? `Analyze this website and give me an honest diagnosis.

URL: ${targetUrl.toString()}
Title: ${pageTitle}

Extracted page content:
---
${pageContent}
---

Respond ONLY in valid JSON with this exact structure (no markdown, no extra text):
{
  "score": [integer from 1 to 10],
  "verdict": "[One direct, memorable sentence capturing the website's state. Max 15 words.]",
  "problemas": [
    "[Specific issue 1 — be concrete, mention what is missing or wrong]",
    "[Specific issue 2]",
    "[Specific issue 3]"
  ],
  "mejoras": [
    "[Concrete improvement 1 — specific action they can take]",
    "[Concrete improvement 2]",
    "[Concrete improvement 3]"
  ]
}` : `Analiza esta página web y dame un diagnóstico honesto.

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

    // Log to Supabase before responding
    await logDemo('roaster', targetUrl.toString(), result, { domain: targetUrl.hostname });

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: isEnglish ? 'Error analyzing. Try again in a moment.' : 'Error al analizar. Intenta de nuevo en un momento.' });
  }
}
