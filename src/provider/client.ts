import { PageSchema, type ProviderPage } from "./types.js";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = Math.random() * exp * 0.2;
  return exp + jitter;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface ProviderClientOptions {
  baseUrl: string;
  limit?: number;
}

/**
 * Забирает одну страницу ленты, самостоятельно переживая 429/500/503,
 * зависшие соединения и сетевые обрывы. Возвращается только тогда, когда
 * страница успешно получена и разобрана — либо после того, как проблема
 * оказалась не временной (сюда сервис из задания попадать не должен).
 */
export async function fetchPage(
  options: ProviderClientOptions,
  cursor: string | null,
): Promise<ProviderPage> {
  const url = new URL("/v1/messages", options.baseUrl);
  url.searchParams.set("limit", String(options.limit ?? 200));
  if (cursor !== null) url.searchParams.set("cursor", cursor);

  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url.toString(), REQUEST_TIMEOUT_MS);
    } catch (err) {
      console.warn(`[provider] сетевая ошибка/таймаут (попытка ${attempt + 1}): ${(err as Error).message}`);
      await sleep(backoffMs(attempt));
      continue;
    }

    if (response.ok) {
      const body = await response.json();
      return PageSchema.parse(body);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) * 1000 + 250;
      console.warn(`[provider] 429, ждём ${Math.round(waitMs / 1000)}с`);
      await sleep(waitMs);
      continue;
    }

    if (response.status === 500 || response.status === 503) {
      console.warn(`[provider] ${response.status} (попытка ${attempt + 1})`);
      await sleep(backoffMs(attempt));
      continue;
    }

    throw new Error(`провайдер вернул неожиданный статус ${response.status}`);
  }
}
