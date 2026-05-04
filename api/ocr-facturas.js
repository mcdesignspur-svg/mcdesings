import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);
const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const ipBuckets = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 10;

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

const SAMPLE_RESULT = {
  vendor_name: 'Office Depot Puerto Rico',
  vendor_id: '660-433-021',
  vendor_address: '300 Ave Roosevelt, San Juan, PR 00918',
  invoice_number: 'INV-2026-04-2189',
  invoice_date: '2026-04-22',
  due_date: '2026-05-22',
  currency: 'USD',
  subtotal: 384.50,
  tax_amount: 41.69,
  total_amount: 426.19,
  line_items: [
    { description: 'Resma de papel carta (caja x10)', quantity: 4, unit_price: 39.99, total: 159.96 },
    { description: 'Cartuchos de tinta HP 67XL Black', quantity: 3, unit_price: 49.99, total: 149.97 },
    { description: 'Sillas ergonómicas oficina', quantity: 2, unit_price: 37.29, total: 74.57 },
  ],
  payment_terms: 'Net 30',
  category_suggestion: 'Office Supplies',
  confidence: 'high',
  notes: 'Factura de muestra — generada para demostrar el flujo. Sube tu factura real para ver tus propios datos.',
  _sample: true,
};

const SYSTEM_PROMPT = `Eres un experto en lectura y extracción de datos de facturas, recibos y comprobantes de gastos.
Tu único trabajo es leer el documento que te muestran, identificar campos clave, y devolver JSON estricto.

REGLAS:
- Devuelve ÚNICAMENTE JSON válido. Sin texto extra, sin markdown, sin comentarios.
- Si un campo no aparece en el documento o no estás seguro, usa null. NUNCA inventes.
- Las fechas siempre en formato ISO YYYY-MM-DD. Si solo aparece el mes/año, asume el día 01.
- Los montos como números (no strings), sin símbolos de moneda. Usa . como separador decimal.
- La moneda en código ISO 4217 (USD, EUR, MXN, etc). Si no es claro, usa "USD".
- vendor_id es el tax ID o registro fiscal del proveedor (EIN, RUC, NIT, CIF, RFC, etc), no el del cliente.
- category_suggestion: una sola categoría contable corta en inglés ("Office Supplies", "Software & Subscriptions", "Travel & Meals", "Professional Services", "Utilities", "Equipment", "Marketing & Advertising", "Other"). Escoge la más cercana.
- confidence: "high" si todo se lee claro, "medium" si algunos campos son borrosos o ambiguos, "low" si el documento es difícil de leer o no parece factura.
- notes: una línea opcional sobre algo notable (calidad de imagen, factura multi-página, anomalías). Vacío si no hay nada que reportar.
- Si el documento NO es una factura/recibo/comprobante, devuelve confidence: "low" y notes explicando qué es.
- line_items: extrae las partidas si están claras. Si la factura no las tiene visibles o son demasiadas, devuelve array vacío.

ESQUEMA EXACTO:
{
  "vendor_name": string|null,
  "vendor_id": string|null,
  "vendor_address": string|null,
  "invoice_number": string|null,
  "invoice_date": string|null,
  "due_date": string|null,
  "currency": string,
  "subtotal": number|null,
  "tax_amount": number|null,
  "total_amount": number|null,
  "line_items": [{ "description": string, "quantity": number|null, "unit_price": number|null, "total": number|null }],
  "payment_terms": string|null,
  "category_suggestion": string,
  "confidence": "high"|"medium"|"low",
  "notes": string
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

  // Sample mode — return canned result for instant demo
  if (req.body?.sample === true) {
    if (!rateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' });
    }
    await logDemo('ocr-facturas', 'sample', SAMPLE_RESULT, { ip, sample: true });
    return res.status(200).json(SAMPLE_RESULT);
  }

  const { fileBase64, mimeType, fileName } = req.body || {};

  if (!fileBase64 || !mimeType) {
    return res.status(400).json({ error: 'Falta el archivo. Sube una factura o recibo.' });
  }
  if (!ACCEPTED_MIME.has(mimeType)) {
    return res.status(400).json({ error: 'Formato no soportado. Sube PDF, JPG o PNG.' });
  }
  // Quick base64 size sanity check
  const approxBytes = Math.floor(fileBase64.length * 0.75);
  if (approxBytes > MAX_BASE64_BYTES) {
    return res.status(413).json({ error: 'Archivo muy grande. Máx 3 MB.' });
  }

  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' });
  }

  // HEIC/HEIF: Claude doesn't support these directly; advise conversion
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return res.status(415).json({ error: 'HEIC no soportado todavía. Convierte a JPG o PDF y sube de nuevo.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Configuración pendiente. Avísale a Miguel.' });
  }

  const client = new Anthropic();

  try {
    const isPdf = mimeType === 'application/pdf';
    const userContent = [
      isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
        : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } },
      { type: 'text', text: 'Lee este documento y extrae todos los campos según el esquema. Devuelve solo el JSON.' },
    ];

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = message.content.find(b => b.type === 'text')?.text?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ocr] no JSON in response:', text.slice(0, 300));
      return res.status(502).json({ error: 'No pude leer el documento. ¿Es una factura/recibo legible?' });
    }

    let extracted;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[ocr] JSON parse error:', err.message);
      return res.status(502).json({ error: 'Respuesta inválida. Intenta con un archivo más claro.' });
    }

    // Minimal shape validation; coerce missing fields to null
    const result = {
      vendor_name: extracted.vendor_name ?? null,
      vendor_id: extracted.vendor_id ?? null,
      vendor_address: extracted.vendor_address ?? null,
      invoice_number: extracted.invoice_number ?? null,
      invoice_date: extracted.invoice_date ?? null,
      due_date: extracted.due_date ?? null,
      currency: extracted.currency || 'USD',
      subtotal: typeof extracted.subtotal === 'number' ? extracted.subtotal : null,
      tax_amount: typeof extracted.tax_amount === 'number' ? extracted.tax_amount : null,
      total_amount: typeof extracted.total_amount === 'number' ? extracted.total_amount : null,
      line_items: Array.isArray(extracted.line_items) ? extracted.line_items : [],
      payment_terms: extracted.payment_terms ?? null,
      category_suggestion: extracted.category_suggestion || 'Other',
      confidence: ['high', 'medium', 'low'].includes(extracted.confidence) ? extracted.confidence : 'medium',
      notes: extracted.notes || '',
    };

    // Fire-and-forget log (no PII beyond filename)
    await logDemo('ocr-facturas', fileName || 'unknown', result, {
      ip,
      mimeType,
      sizeBytes: approxBytes,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[ocr] anthropic error:', err?.message);
    if (err?.status === 429) {
      return res.status(503).json({ error: 'Mucho tráfico ahora mismo. Intenta en un minuto.' });
    }
    return res.status(500).json({ error: 'Error procesando el documento. Intenta de nuevo.' });
  }
}
