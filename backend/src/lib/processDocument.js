import { randomUUID } from "node:crypto";
import { extractDocumentText } from "./textExtraction.js";
import { chunkPages } from "./chunk.js";
import { embedTexts, isGeminiConfigured } from "./gemini.js";

/**
 * Runs the full ingestion pipeline for a freshly uploaded document:
 * extract text -> chunk -> (optionally) embed -> store chunks -> mark ready.
 * Designed to be called without awaiting from the upload route, so the upload
 * response returns immediately while processing continues in the background.
 *
 * @param {import('pg').Pool} pool
 * @param {{ id: string, userId: string, filePath: string, fileType: string }} document
 */
export async function processDocument(pool, { id, userId, filePath, fileType }) {
  try {
    await pool.query("UPDATE documents SET status='processing' WHERE id=$1", [id]);

    const { pageCount, pages } = await extractDocumentText(filePath, fileType);
    const chunks = chunkPages(pages);

    if (!chunks.length) {
      await pool.query("UPDATE documents SET status='ready', page_count=$2 WHERE id=$1", [id, pageCount]);
      return;
    }

    let embeddings = [];
    if (isGeminiConfigured()) {
      embeddings = await embedTexts(chunks.map((chunk) => chunk.text), "RETRIEVAL_DOCUMENT");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < chunks.length; i++) {
        const vector = embeddings[i] ? `[${embeddings[i].join(",")}]` : null;
        await client.query(
          `INSERT INTO document_chunks(id, document_id, user_id, chunk_index, page_number, content, embedding)
           VALUES($1,$2,$3,$4,$5,$6,$7::vector)`,
          [randomUUID(), id, userId, i, chunks[i].page, chunks[i].text, vector]
        );
      }
      await client.query("UPDATE documents SET status='ready', page_count=$2 WHERE id=$1", [id, pageCount]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    if (!isGeminiConfigured()) {
      console.warn(`Document ${id} indexed without embeddings - GEMINI_API_KEY is not set, so chat will fall back to keyword search for this document.`);
    }
  } catch (error) {
    console.error(`Failed to process document ${id}:`, error);
    await pool.query("UPDATE documents SET status='failed' WHERE id=$1", [id]).catch(() => {});
  }
}
