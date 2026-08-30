// HTTP helper for Finnish public-data APIs.
// Eduskunta's avoin data API serves ISO-8859-1 encoded JSON without a charset.

export async function fetchJsonLatin1<T = unknown>(url: string, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("iso-8859-1").decode(buf);
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchTextLatin1(url: string, timeoutMs = 30_000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder("iso-8859-1").decode(buf);
  } finally {
    clearTimeout(t);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}