import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    company,
    contact_email,
    contact_name,
    aircraft,
    ata_chapter,
    part_number,
    part_description,
    condition,
    quantity,
    required_by,
    notes,
    language,
  } = req.body;

  if (!company || !aircraft || !part_number || !condition || !required_by) {
    return res.status(400).json({ error: 'Faltan datos requeridos del RFQ.' });
  }

  const client = new Anthropic();

  const customerLang = language === 'es' ? 'Spanish' : 'English';

  const systemPrompt = `You are the AI lead-routing and quote-drafting agent for Parts Aviation Solutions, a B2B aviation parts sourcing and AOG support company in Davenport, FL.

Your job is to analyze inbound RFQs and produce structured JSON output that classifies the request, routes it to the right rep, drafts an acknowledgment to the customer, and drafts a quote response.

Team & routing rules:
- Christopher Diaz (CEO) — escalations only
- AJ Caballero (COO) — AOG / urgent / on-call (any AOG flag routes here)
- Aldo Ponce (Sales Director) — engines, landing gear, high-value structural parts, complex sourcing
- Anetchalie Hernandez (Account Manager) — avionics, routine inventory parts, repeat customers
- Juan Maldonado (IT Manager) — system issues only, never customer RFQs

AOG detection rules:
- If "required_by" is within 24 hours → AOG = true, urgency = "AOG"
- If "required_by" is 24-72 hours OR notes mention "AOG", "grounded", "emergency", "urgent", "ASAP" → urgency = "RUSH", AOG = true
- Otherwise AOG = false, urgency = "STANDARD"

Aviation parts knowledge:
- Conditions: SV (Serviceable), OH (Overhauled), AR (As Removed), NE (New). OH typically commands premium price + longer lead time.
- ATA chapters: 21=Air Cond, 22=Auto Flight, 23=Comms, 24=Electrical, 25=Equipment/Furnishings, 26=Fire Protection, 27=Flight Controls, 28=Fuel, 29=Hydraulic, 30=Ice/Rain Protection, 31=Indicating/Recording (Avionics), 32=Landing Gear, 33=Lights, 34=Navigation, 35=Oxygen, 36=Pneumatic, 49=APU, 71-80=Engines/Powerplant
- All parts shipped with Form 8130-3 traceability when applicable
- Lead times: NE 1-3 days, SV 2-5 days, OH 5-10 days, AR varies. AOG flag should compress these aggressively (same-day or next-day prioritization).

Output ONLY valid JSON in this exact structure (no markdown, no commentary):
{
  "classification": {
    "aog_flag": true|false,
    "urgency": "AOG"|"RUSH"|"STANDARD",
    "category": "[short category name e.g. 'Avionics', 'Landing Gear', 'Engines/APU', 'Hydraulic']",
    "ata_chapter_inferred": "[best guess at ATA chapter, e.g. '32 — Landing Gear']",
    "complexity": "ROUTINE"|"COMPLEX"|"ESCALATION"
  },
  "routing": {
    "rep_name": "[full name from team list]",
    "rep_role": "[role from team list]",
    "reason": "[1 sentence: why this rep]"
  },
  "customer_acknowledgment": "[a short professional message to the customer in ${customerLang}, confirming receipt, giving a ticket reference like RFQ-{6-digit-number}, and stating expected response window. AOG cases get an urgent, reassuring tone. Keep it 3-4 sentences max.]",
  "quote_draft": {
    "subject": "[email subject line in ${customerLang}, e.g. 'Quote: [part number] for [aircraft] — RFQ-XXXXXX']",
    "body": "[professional aviation-rep email in ${customerLang}, drafted to the customer. Should: greet by name if provided, reference their request, propose 1-2 condition options with realistic price RANGE (use 'TBD pending supplier confirm' for unknowns — do NOT invent specific prices), state lead time per condition, mention Form 8130-3 traceability, sign off as the routed rep. Realistic length: 5-8 short paragraphs. Tone: confident, helpful, NOT salesy.]"
  },
  "internal_notes": "[1-2 sentences for the rep — what to verify, who to call, or any flag worth noting]"
}`;

  const userMessage = `New RFQ submitted via web form. Process it.

Company: ${company}
Contact: ${contact_name || 'not provided'} (${contact_email || 'no email'})
Aircraft: ${aircraft}
ATA Chapter (if provided): ${ata_chapter || 'not specified — infer from part'}
Part Number: ${part_number}
Part Description: ${part_description || 'not provided'}
Condition Needed: ${condition}
Quantity: ${quantity || 1}
Required By: ${required_by}
Customer Notes: ${notes || 'none'}
Customer Language: ${customerLang}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Formato de respuesta inesperado');

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      !parsed.classification ||
      typeof parsed.classification.aog_flag !== 'boolean' ||
      !parsed.routing?.rep_name ||
      !parsed.customer_acknowledgment ||
      !parsed.quote_draft?.body
    ) {
      throw new Error('Estructura inválida');
    }

    await logDemo(
      'aviation-rfq',
      `${company} — ${part_number}`,
      parsed,
      { aircraft, condition, urgency: parsed.classification.urgency, language: customerLang }
    );

    return res.status(200).json(parsed);
  } catch {
    return res.status(500).json({ error: 'Error procesando el RFQ. Intenta de nuevo.' });
  }
}
