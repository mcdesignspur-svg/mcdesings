import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Validate a user-supplied URL for safe server-side fetching.
 * Blocks private/loopback/link-local IPs, non-https schemes, and IP literals.
 *
 * Returns { ok: true, url: URL } or { ok: false, reason: string }.
 */
export async function validateExternalUrl(rawUrl, { allowHttp = false } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, reason: 'URL requerida.' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { ok: false, reason: 'URL inválida.' };
  }

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    return { ok: false, reason: 'Solo se permiten URLs https.' };
  }

  const hostname = parsed.hostname;

  // Reject IP literals — only hostnames allowed (forces DNS lookup path).
  if (net.isIP(hostname)) {
    return { ok: false, reason: 'IP literals no permitidas.' };
  }

  // Reject obviously local hostnames before DNS.
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === 'metadata.google.internal'
  ) {
    return { ok: false, reason: 'Hostname no permitido.' };
  }

  // Resolve and check every returned address.
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { ok: false, reason: 'No se pudo resolver el hostname.' };
  }

  for (const { address, family } of addresses) {
    if (isPrivateAddress(address, family)) {
      return { ok: false, reason: 'La URL apunta a una red privada.' };
    }
  }

  return { ok: true, url: parsed };
}

function isPrivateAddress(addr, family) {
  if (family === 4) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local + cloud metadata)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
    // 100.64.0.0/10 (CGNAT / Tailscale)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const a = addr.toLowerCase();
    if (a === '::1' || a === '::') return true;
    if (a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')) return true;
    // IPv4-mapped — recurse on the v4 portion.
    if (a.startsWith('::ffff:')) {
      const v4 = a.slice(7);
      if (net.isIP(v4) === 4) return isPrivateAddress(v4, 4);
    }
    return false;
  }
  return true;
}
