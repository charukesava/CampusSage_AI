import { embedTexts, isGeminiConfigured } from "./gemini.js";

const VECTOR_TOP_K = 12;
const KEYWORD_TOP_K = 12;
const FINAL_TOP_K = 8;
const MAX_VECTOR_DISTANCE = 0.72;

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function significantWords(question) {
  return [...new Set(normalize(question).match(/[a-z0-9][a-z0-9+#.-]{2,}/g) || [])]
    .filter((word) => !["what", "when", "where", "which", "with", "from", "that", "this", "about", "explain", "give", "tell", "does", "have", "there", "their"].includes(word))
    .slice(0, 12);
}

/**
 * Hybrid retrieval is optional context for the general-purpose AI.
 * Profile information boosts the student's current semester/subjects but never
 * hard-restricts retrieval, so general questions remain answerable by Gemini.
 */
export async function retrieveRelevantChunks(pool, userId, question, profile = null) {
  const [vectorRows, keywordRows] = await Promise.all([
    isGeminiConfigured() ? retrieveByVectorSearch(pool, userId, question).catch(() => []) : Promise.resolve([]),
    retrieveByKeywordSearch(pool, userId, question).catch(() => []),
  ]);

  const merged = new Map();

  for (const row of vectorRows) {
    merged.set(`${row.documentId}-${row.page}`, {
      ...row,
      score: Math.max(0, 1 - Number(row.distance || 1)),
      vectorScore: Math.max(0, 1 - Number(row.distance || 1)),
      keywordScore: 0,
    });
  }

  for (const row of keywordRows) {
    const key = `${row.documentId}-${row.page}`;
    const existing = merged.get(key);
    if (existing) {
      existing.keywordScore = Number(row.keywordScore || 0);
      existing.score += Number(row.keywordScore || 0) * 0.08;
    } else {
      merged.set(key, {
        ...row,
        score: Number(row.keywordScore || 0) * 0.08,
        vectorScore: 0,
        keywordScore: Number(row.keywordScore || 0),
      });
    }
  }

  const profileSemester = normalize(profile?.semester);
  const profileSubjects = Array.isArray(profile?.subjects) ? profile.subjects.map(normalize).filter(Boolean) : [];

  for (const item of merged.values()) {
    if (profileSemester && normalize(item.semester) === profileSemester) item.score += 0.05;
    if (profileSubjects.some((subject) => normalize(item.subject).includes(subject) || subject.includes(normalize(item.subject)))) {
      item.score += 0.08;
    }
  }

  return [...merged.values()]
    .filter((item) => item.vectorScore > 0 || item.keywordScore > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, FINAL_TOP_K)
    .map(({ vectorScore, keywordScore, score, distance, ...item }) => item);
}

async function retrieveByVectorSearch(pool, userId, question) {
  const [queryEmbedding] = await embedTexts([question], "RETRIEVAL_QUERY");
  if (!queryEmbedding?.length) return [];

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const result = await pool.query(
    `SELECT dc.page_number, dc.content, d.id AS document_id, d.display_name,
            d.semester, d.subject, dc.embedding <=> $2::vector AS distance
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.user_id = $1 AND dc.embedding IS NOT NULL
     ORDER BY distance ASC
     LIMIT $3`,
    [userId, vectorLiteral, VECTOR_TOP_K]
  );

  return result.rows
    .filter((row) => Number(row.distance) <= MAX_VECTOR_DISTANCE)
    .map((row) => ({
      documentId: row.document_id,
      label: row.display_name,
      page: row.page_number,
      text: row.content,
      semester: row.semester,
      subject: row.subject,
      distance: Number(row.distance),
    }));
}

async function retrieveByKeywordSearch(pool, userId, question) {
  const words = significantWords(question);
  if (!words.length) return [];

  const conditions = words.map((_, i) => `dc.content ILIKE $${i + 2}`).join(" OR ");
  const scoreExpr = words.map((_, i) => `(CASE WHEN dc.content ILIKE $${i + 2} THEN 1 ELSE 0 END)`).join(" + ");
  const params = [userId, ...words.map((word) => `%${word}%`)];

  const result = await pool.query(
    `SELECT dc.page_number, dc.content, d.id AS document_id, d.display_name,
            d.semester, d.subject, (${scoreExpr}) AS keyword_score
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.user_id = $1 AND (${conditions})
     ORDER BY keyword_score DESC
     LIMIT ${KEYWORD_TOP_K}`,
    params
  );

  return result.rows.map((row) => ({
    documentId: row.document_id,
    label: row.display_name,
    page: row.page_number,
    text: row.content,
    semester: row.semester,
    subject: row.subject,
    keywordScore: Number(row.keyword_score || 0) / words.length,
  }));
}
