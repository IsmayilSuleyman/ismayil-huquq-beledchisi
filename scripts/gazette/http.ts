/**
 * Fetching for the gazette scripts: a plain user agent that says who is
 * asking, a timeout, and retries with backoff for the dropped connections
 * some government sites produce. A refusal (401, 403, 404) is an answer and
 * is not retried; nothing here tries to get around one.
 */

const UA = "Mozilla/5.0 (compatible; OmniLawGazette/2.0; +https://omnilawgazette.vercel.app)";

let retried = 0;

/** Requests retried so far in this process. */
export function retryCount(): number {
  return retried;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a URL, up to four attempts. */
export async function fetchWithRetry(url: string, accept = "text/html"): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      retried++;
      await sleep(2000 * 2 ** (attempt - 1));
    }
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "az" },
        signal: AbortSignal.timeout(45_000),
      });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status} for ${url}`);
      if (res.status === 401 || res.status === 403 || res.status === 404) break;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** GET a URL as text. */
export async function getText(url: string, accept = "text/html"): Promise<string> {
  return (await fetchWithRetry(url, accept)).text();
}
