import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}
const model = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
// A second small model. Free-tier quotas are per model, so this keeps working when the primary is rate-limited.
const fallbackModel = () => process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';
const retryDelayMs = () => Number(process.env.GEMINI_RETRY_DELAY_MS ?? 800);

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** Rate limits, overload and network failures are worth retrying; a 400 (bad request) is not. */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === 'number') return RETRYABLE_STATUS.has(status);
  return err instanceof TypeError || /fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(String(err));
}

/**
 * Primary model, one retry after a short pause, then the fallback model.
 * Worst case is three quick failed calls, which fits the pipeline's 10 s explanation budget.
 */
async function withRetryAndFallback<T>(call: (modelId: string) => Promise<T>): Promise<T> {
  const primary = model();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await call(primary);
    } catch (err) {
      if (!isRetryable(err)) throw err;
      console.warn(`Gemini ${primary} attempt ${attempt} failed, will retry`, (err as Error).message);
      const fallback = fallbackModel();
      if (attempt === 2 && fallback === primary) throw err;
      if (attempt === 1) await new Promise((r) => setTimeout(r, retryDelayMs()));
    }
  }
  console.warn(`Gemini falling back to ${fallbackModel()}`);
  return call(fallbackModel());
}

export type GeminiInput =
  | { type: 'text'; text: string }
  | { type: 'document'; data: string; mime_type: string } // base64 PDF
  | { type: 'image'; data: string; mime_type: string }; // base64 image

// Uses generateContent: the Interactions API's v1 endpoint rejects `document` (PDF) inputs
// (smoke-tested 2026-11-14), so this is the plan's documented fallback.
export async function generateJson<T>(input: GeminiInput[], schema: object): Promise<T> {
  const contents = input.map((part) =>
    part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mime_type, data: part.data } });
  const response = await withRetryAndFallback((modelId) => client().models.generateContent({
    model: modelId,
    contents,
    config: { responseMimeType: 'application/json', responseSchema: schema },
  }));
  if (!response.text) throw new Error('Gemini returned no text output');
  return JSON.parse(response.text) as T;
}

export async function generateText(prompt: string): Promise<string> {
  const response = await withRetryAndFallback((modelId) =>
    client().models.generateContent({ model: modelId, contents: prompt }));
  return (response.text ?? '').trim();
}
