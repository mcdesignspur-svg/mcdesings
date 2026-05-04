// Calls Google PageSpeed Insights API (free, no auth) and returns
// a curated subset focused on what matters for La Presencia's
// <2s load-time promise: LCP, performance score, top opportunities.

export const config = { maxDuration: 30 };

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

// Cache by URL+strategy for 5 min — same person retesting won't re-hit Google
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.data;
}

function cacheSet(key, data) {
  cache.set(key, { t: Date.now(), data });
}

function normalizeUrl(input) {
  let url = String(input || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.href;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Demasiados análisis desde tu IP. Espera una hora o agenda diagnóstico.' });
  }

  const url = normalizeUrl(req.body?.url);
  if (!url) {
    return res.status(400).json({ error: 'URL inválida. Ejemplo: https://tunegocio.com' });
  }

  // Mobile strategy is primary (Google ranks mobile-first since 2018)
  const cacheKey = `mobile:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.status(200).json({ ...cached, _cached: true });

  const params = new URLSearchParams({
    url,
    strategy: 'mobile',
    category: 'performance',
    locale: 'es',
  });

  // Optional API key (higher rate limits) — works without it
  if (process.env.PAGESPEED_API_KEY) {
    params.set('key', process.env.PAGESPEED_API_KEY);
  }

  try {
    const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
    const r = await fetch(psUrl);
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      const errMsg = data?.error?.message || '';
      const errReason = data?.error?.errors?.[0]?.reason || '';
      console.error('[speedtest] PageSpeed HTTP error', r.status, errReason, errMsg.slice(0, 300));

      if (r.status === 429) {
        return res.status(429).json({ error: 'Google rate-limited el demo. Intenta en unos minutos o agenda diagnóstico directo.' });
      }
      if (errReason === 'lighthouseError' || /lighthouse/i.test(errMsg)) {
        return res.status(400).json({ error: 'El sitio cargó pero Lighthouse no pudo medirlo (puede estar bloqueando bots, requiere login, o tomó muy lento). Intenta con otra URL.' });
      }
      if (r.status === 400 || r.status === 422) {
        return res.status(400).json({ error: errMsg || 'No pudimos analizar ese sitio. Verifica la URL o intenta con otro.' });
      }
      return res.status(502).json({ error: `PageSpeed devolvió ${r.status}. ${errMsg ? errMsg.slice(0, 120) : 'Intenta en un minuto.'}` });
    }

    const lhr = data.lighthouseResult;
    if (!lhr) {
      return res.status(502).json({ error: 'Respuesta inválida de PageSpeed (sin lighthouseResult).' });
    }
    if (lhr.runtimeError && lhr.runtimeError.code) {
      console.error('[speedtest] Lighthouse runtimeError', lhr.runtimeError);
      return res.status(400).json({ error: `El sitio no se pudo medir: ${lhr.runtimeError.message || lhr.runtimeError.code}` });
    }

    // Curated payload — only what the demo renders
    const audits = lhr.audits || {};
    const perfScore = Math.round((lhr.categories?.performance?.score ?? 0) * 100);

    const lcpAudit = audits['largest-contentful-paint'];
    const fcpAudit = audits['first-contentful-paint'];
    const tbtAudit = audits['total-blocking-time'];
    const clsAudit = audits['cumulative-layout-shift'];
    const speedIndexAudit = audits['speed-index'];

    // Top opportunities sorted by potential savings (ms)
    const opportunities = Object.values(audits)
      .filter(a => a.details?.type === 'opportunity' && (a.details.overallSavingsMs ?? 0) > 100)
      .map(a => ({
        title: a.title,
        description: a.description?.split('[')[0]?.trim() || '', // strip markdown links
        savingsMs: a.details.overallSavingsMs ?? 0,
        score: a.score ?? null,
      }))
      .sort((a, b) => b.savingsMs - a.savingsMs)
      .slice(0, 3);

    const result = {
      url: lhr.finalUrl || url,
      fetchedAt: lhr.fetchTime,
      perfScore,
      metrics: {
        lcp:        { value: lcpAudit?.numericValue ?? null,        display: lcpAudit?.displayValue ?? null,        score: lcpAudit?.score ?? null },
        fcp:        { value: fcpAudit?.numericValue ?? null,        display: fcpAudit?.displayValue ?? null,        score: fcpAudit?.score ?? null },
        tbt:        { value: tbtAudit?.numericValue ?? null,        display: tbtAudit?.displayValue ?? null,        score: tbtAudit?.score ?? null },
        cls:        { value: clsAudit?.numericValue ?? null,        display: clsAudit?.displayValue ?? null,        score: clsAudit?.score ?? null },
        speedIndex: { value: speedIndexAudit?.numericValue ?? null, display: speedIndexAudit?.displayValue ?? null, score: speedIndexAudit?.score ?? null },
      },
      opportunities,
    };

    cacheSet(cacheKey, result);
    return res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[speedtest]', msg);
    return res.status(500).json({ error: 'Error analizando el sitio. Intenta de nuevo.' });
  }
}
