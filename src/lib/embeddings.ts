import { GoogleGenAI } from '@google/genai';
import { EMBEDDING_DIM, mockEmbedding } from './similar';
import { isMock } from './util';

let ai: GoogleGenAI | null = null;
const model = () => process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

/** One embedding of EMBEDDING_DIM numbers. MOCK_EMBEDDINGS=1 returns a deterministic local vector. */
export async function embedText(text: string): Promise<number[]> {
  if (isMock('EMBEDDINGS')) return mockEmbedding(text);
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.embedContent({
    model: model(),
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIM, taskType: 'SEMANTIC_SIMILARITY' },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding model returned ${values?.length ?? 0} values, expected ${EMBEDDING_DIM}`);
  }
  return values;
}
