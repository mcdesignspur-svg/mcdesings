import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { negocio, messages, lang = 'es' } = req.body;
  const isEnglish = lang === 'en';

  if (!negocio || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: isEnglish ? 'Required data is missing.' : 'Faltan datos requeridos.' });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: isEnglish ? `You are the virtual assistant for "${negocio}". Your job is to help customers of this business in a friendly, useful way.

Rules:
- Respond in clear, warm, natural English
- Be concise: maximum 3-4 sentences per response
- If you do not have specific business information, say someone will verify and follow up soon
- Do not invent prices, hours, or details you were not given
- At the end of your first response, ask how you can help the customer

You are an example of what MC Designs builds for businesses.` : `Eres el asistente virtual de "${negocio}". Tu trabajo es atender clientes de este negocio de forma amigable y útil.

Reglas:
- Responde en español de Puerto Rico — natural, cálido, directo
- Sé conciso: máximo 3-4 oraciones por respuesta
- Si no tienes información específica del negocio, di que con gusto van a verificar y que alguien del equipo se comunicará pronto
- No inventes precios, horarios ni detalles que no te dieron
- Al final de tu primera respuesta, pregunta cómo puedes ayudar al cliente

Eres un ejemplo de lo que MC Designs construye para negocios en Puerto Rico.`,
      messages,
    });

    const reply = response.content[0].text;

    // Log first message only (when messages.length === 1)
    if (messages.length === 1) {
      await logDemo('chatbot', negocio, { primer_mensaje: messages[0].content, respuesta: reply }, { negocio });
    }

    return res.status(200).json({ reply });
  } catch {
    return res.status(500).json({ error: isEnglish ? 'Chatbot error. Try again.' : 'Error del chatbot. Intenta de nuevo.' });
  }
}
