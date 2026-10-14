/**
 * Gemini client
 *
 * - API key travels in the `x-goog-api-key` header (never in the URL, which
 *   ends up in proxy and access logs).
 * - Transient failures (429/500/503, timeouts) are retried with backoff.
 * - Upstream error bodies are logged, never returned to API clients.
 */

import { config } from '@config/config';
import { AppError } from '@shared/middleware/errorHandler';
import { createLogger } from '@shared/utils/logger';
import { GeminiGenerateJsonOptions, GeminiUsageMetadata } from '../types/ai.types';

const log = createLogger('Gemini');

interface GeminiApiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

/** Error raised for Gemini failures; `quota` marks rate-limit exhaustion. */
export class GeminiError extends AppError {
  constructor(message: string, statusCode: number, public readonly quota = false) {
    super(message, statusCode);
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stripJsonFences = (value: string): string =>
  value.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

const parseJson = <T>(raw: string): T => {
  try {
    return JSON.parse(stripJsonFences(raw)) as T;
  } catch {
    log.warn('Gemini returned invalid JSON', raw.slice(0, 200));
    throw new GeminiError('AI returned an unreadable response', 502);
  }
};

export const isGeminiConfigured = (): boolean => config.ai.enabled && Boolean(config.ai.geminiApiKey);

export const getGeminiUsageMetadata = (): GeminiUsageMetadata => ({
  model: config.ai.geminiModel,
  provider: 'gemini',
});

const requestOnce = async (prompt: string, temperature: number, jsonMode: boolean): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const response = await fetch(`${config.ai.geminiBaseUrl}/models/${config.ai.geminiModel}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.ai.geminiApiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log.warn(`Gemini HTTP ${response.status}`, body.slice(0, 300));
      const quota = response.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(body);
      throw new GeminiError(
        quota ? 'AI quota is temporarily exhausted' : 'AI service request failed',
        RETRYABLE_STATUS.has(response.status) ? 503 : 502,
        quota
      );
    }

    const data = (await response.json()) as GeminiApiResponse;
    if (data.promptFeedback?.blockReason) {
      throw new GeminiError('The AI declined to answer this request', 422);
    }

    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!text) throw new GeminiError('AI returned an empty response', 502);
    return text;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new GeminiError('AI request timed out', 504);
    if (error instanceof GeminiError) throw error;
    log.warn('Gemini network error', error?.message);
    throw new GeminiError('AI service is unreachable', 503);
  } finally {
    clearTimeout(timeout);
  }
};

const callGemini = async (prompt: string, temperature: number, jsonMode: boolean): Promise<string> => {
  if (!isGeminiConfigured()) {
    throw new GeminiError('AI is not configured', 503);
  }

  let lastError: GeminiError | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestOnce(prompt, temperature, jsonMode);
    } catch (error) {
      lastError = error as GeminiError;
      const retryable = lastError.statusCode === 503 || lastError.statusCode === 504;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await sleep(400 * 2 ** (attempt - 1));
    }
  }
  throw lastError ?? new GeminiError('AI service request failed', 502);
};

export const generateJson = async <T>({ prompt, temperature = 0.1 }: GeminiGenerateJsonOptions): Promise<T> =>
  parseJson<T>(await callGemini(prompt, temperature, true));

export const generateText = async (prompt: string, temperature = 0.4): Promise<string> =>
  callGemini(prompt, temperature, false);

export const isGeminiQuotaError = (error: unknown): boolean => error instanceof GeminiError && error.quota;
