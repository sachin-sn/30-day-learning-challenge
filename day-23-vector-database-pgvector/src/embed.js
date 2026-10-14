import { pipeline } from "@huggingface/transformers";

export const MODEL = "Xenova/all-MiniLM-L6-v2";
let extractor;

export async function loadModel() {
  extractor ??= await pipeline("feature-extraction", MODEL);
  return extractor;
}

// Text in, array of numbers out (mean-pooled and normalised to length 1).
export async function embed(text) {
  const ex = await loadModel();
  const out = await ex(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

// Cosine similarity: how much two vectors point in the same direction (1 = same, 0 = unrelated).
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function topK(queryVector, items, k = 3) {
  return items
    .map((item) => ({ id: item.id, text: item.text, score: cosine(queryVector, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
