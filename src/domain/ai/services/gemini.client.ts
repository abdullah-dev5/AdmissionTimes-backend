import { config } from '@config/config';
import { AppError } from '@shared/middleware/errorHandler';
import { GeminiGenerateJsonOptions, GeminiUsageMetadata } from '../types/ai.types';

interface GeminiResponsePart {
  text?: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiResponsePart[];
  };
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
}

const stripJsonFences = (value: string): string => {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

const parseJson = <T>(raw: string): T => {
  const cleaned = stripJsonFences(raw);
  return JSON.parse(cleaned) as T;
};

export const isGeminiConfigured = (): boolean => {
  return config.ai.enabled && Boolean(config.ai.geminiApiKey);
};

export const getGeminiUsageMetadata = (): GeminiUsageMetadata => ({
  model: config.ai.geminiModel,
  provider: 'gemini',
});

const callGemini = async (prompt: string, temperature: number, jsonMode: boolean): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const generationConfig: Record<string, unknown> = { temperature };
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(
      `${config.ai.geminiBaseUrl}/models/${config.ai.geminiModel}:generateContent?key=${config.ai.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`Gemini request failed: ${response.status} ${errorText}`, 502);
    }

    const data = (await response.json()) as GeminiApiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();

    if (!text) {
      throw new AppError('Gemini returned an empty response', 502);
    }

    return text;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AppError('Gemini request timed out', 504);
    }
    if (error instanceof AppError) throw error;
    throw new AppError(`Gemini request failed: ${error?.message || String(error)}`, 502);
  } finally {
    clearTimeout(timeout);
  }
};

export const generateJson = async <T>({ prompt, temperature = 0.1 }: GeminiGenerateJsonOptions): Promise<T> => {
  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }
  const text = await callGemini(prompt, temperature, true);
  return parseJson<T>(text);
};

export const generateText = async (prompt: string, temperature = 0.4): Promise<string> => {
  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }
  return callGemini(prompt, temperature, false);
};
