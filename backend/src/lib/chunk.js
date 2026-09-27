const DEFAULT_CHUNK_SIZE = 1200; // characters (~250-300 tokens) - a good match for embedding models
const DEFAULT_OVERLAP = 150; // characters of overlap so we don't split a sentence's meaning in two

/**
 * Splits per-page text into overlapping chunks, keeping track of which page
 * each chunk came from so answers can cite a page number.
 *
 * @param {{ page: number, text: string }[]} pages
 * @returns {{ page: number, text: string }[]}
 */
export function chunkPages(pages, { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
  const chunks = [];
  for (const { page, text } of pages) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) continue;

    if (clean.length <= chunkSize) {
      chunks.push({ page, text: clean });
      continue;
    }

    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkSize, clean.length);
      const slice = clean.slice(start, end).trim();
      if (slice) chunks.push({ page, text: slice });
      if (end >= clean.length) break;
      start = end - overlap;
    }
  }
  return chunks;
}
