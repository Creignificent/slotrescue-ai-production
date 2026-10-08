const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (row.n >= limit) return { ok: false, remaining: 0 };
  row.n += 1;
  return { ok: true, remaining: limit - row.n };
}
