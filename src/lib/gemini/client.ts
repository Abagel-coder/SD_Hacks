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

export async function generateJson<T>(input: GeminiInput[], schema: object): Promise<T> {
  const interaction = await client().interactions.create({
    model: model(),
    input,
    response_format: { type: 'text', mime_type: 'application/json', schema },
  });
  if (!interaction.output_text) throw new Error('Gemini returned no text output');
  return JSON.parse(interaction.output_text) as T;
}

export async function generateText(prompt: string): Promise<string> {
  const interaction = await client().interactions.create({
    model: model(),
    input: [{ type: 'text', text: prompt }],
  });
  return (interaction.output_text ?? '').trim();
}
