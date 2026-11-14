import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}
const model = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

export type GeminiInput =
  | { type: 'text'; text: string }
  | { type: 'document'; data: string; mime_type: string } // base64 PDF
  | { type: 'image'; data: string; mime_type: string }; // base64 image

// Uses generateContent: the Interactions API's v1 endpoint rejects `document` (PDF) inputs
// (smoke-tested 2026-11-14), so this is the plan's documented fallback.
export async function generateJson<T>(input: GeminiInput[], schema: object): Promise<T> {
  const response = await client().models.generateContent({
    model: model(),
    contents: input.map((part) =>
      part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mime_type, data: part.data } }),
    config: { responseMimeType: 'application/json', responseSchema: schema },
  });
  if (!response.text) throw new Error('Gemini returned no text output');
  return JSON.parse(response.text) as T;
}

export async function generateText(prompt: string): Promise<string> {
  const response = await client().models.generateContent({ model: model(), contents: prompt });
  return (response.text ?? '').trim();
}
