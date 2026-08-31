// HTTP helpers for public-data ingestion with retries and concurrency.

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

/** Retry with exponential backoff for transient failures (429/5xx/network). */
export async function fetchJsonLatin1Retry<T = unknown>(
  url: string,
  opts: { timeoutMs?: number; maxRetries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { timeoutMs = 30_000, maxRetries = 3, headers = {} } = opts;
  let attempt = 0;
  for (;;) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json", ...headers },
        });
        if (res.status === 429 || res.status >= 500) {
          throw new TransientError(`HTTP ${res.status} for ${url}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const buf = await res.arrayBuffer();
        const text = new TextDecoder("iso-8859-1").decode(buf);
        return JSON.parse(text) as T;
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      const transient = e instanceof TransientError || (e instanceof Error && e.name === "AbortError");
      if (transient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 500);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
}

export class TransientError extends Error {}

/** Fetch JSON that is genuinely UTF-8 encoded (standard JSON). */
export async function fetchJsonUtf8Retry<T = unknown>(
  url: string,
  opts: { timeoutMs?: number; maxRetries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { timeoutMs = 30_000, maxRetries = 3, headers = {} } = opts;
  let attempt = 0;
  for (;;) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json", ...headers },
        });
        if (res.status === 429 || res.status >= 500) {
          throw new TransientError(`HTTP ${res.status} for ${url}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return (await res.json()) as T;
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      const transient = e instanceof TransientError || (e instanceof Error && e.name === "AbortError");
      if (transient && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 500);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

export function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}