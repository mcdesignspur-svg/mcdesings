// Curated case study summaries for the site chatbot's find_similar_case tool.
// Update when new case studies ship.

export const CASES = [
  {
    id: 'beboutique',
    name: 'BE Boutique',
    industry: 'ecommerce',
    keywords: ['ropa', 'boutique', 'moda', 'shopify', 'tienda online', 'ecommerce', 'productos', 'inventario'],
    summary:
      'Boutique de ropa en PR. Tienda Shopify, branding y client portal en ops.mcdesignspr.com. 50% deposit, en producción.',
    services: ['shopify', 'branding', 'web design'],
    url: '/portfolio',
  },
  {
    id: 'mcpromo',
    name: 'Miguel Cotto Promotions',
    industry: 'sports/entertainment',
    keywords: [
      'plataforma',
      'admin',
      'dashboard',
      'rediseño',
      'dark mode',
      'web app',
      'panel',
      'sistema interno',
      'multi-dominio',
      'boxeo',
    ],
    summary:
      'Rediseño dark mode + admin panel custom para que el equipo actualice eventos, boletos y comunicados sin depender de un dev. Multi-dominio consolidado en Vercel. Stack: Google Stitch, Antigravity, PostgreSQL, Vercel.',
    services: ['web design', 'web app', 'admin tooling'],
    url: '/portfolio#card-mcp',
  },
  {
    id: 'teamdrita',
    name: 'Team Drita y Mely (Hibody)',
    industry: 'wellness/ecommerce',
    keywords: ['shopify', 'wellness', 'salud', 'bienestar', 'bundles', 'ecommerce', 'tienda', 'mobile-first', 'hibody'],
    summary:
      'Tienda Shopify desde cero para coaches de wellness Sandra y Melissa (marca Hibody). Bundles configurados, mobile-first, contenido bilingüe, analítica nativa. Entregado en 3-4 semanas.',
    services: ['shopify', 'ecommerce', 'web design'],
    url: '/portfolio#card-drita',
  },
];

const STOP = new Set([
  'el','la','los','las','un','una','de','del','en','con','para','por','y','o','que','un','si',
  'the','a','an','of','for','in','to','and','or','my','i','have','has','want','need',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w.length > 2 && !STOP.has(w));
}

export function findCases(query, limit = 2) {
  const tokens = new Set(tokenize(query));
  if (tokens.size === 0) return [];

  const scored = CASES.map((c) => {
    const haystack = [c.industry, ...c.keywords, ...c.services, c.summary, c.name].join(' ');
    const hay = new Set(tokenize(haystack));
    let score = 0;
    for (const t of tokens) if (hay.has(t)) score++;
    return { case: c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.case);
}
