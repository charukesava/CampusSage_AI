const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768);
const EMBED_BATCH_SIZE = 90;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function embeddingDimensions() {
  return EMBEDDING_DIMENSIONS;
}

export async function embedTexts(texts, taskType) {
  if (!texts.length) return [];
  const apiKey = requireApiKey();
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const response = await fetch(`${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    });
    if (!response.ok) throw new Error(`Gemini embedding request failed (${response.status}): ${await safeText(response)}`);
    const data = await response.json();
    for (const embedding of data.embeddings || []) vectors.push(embedding.values);
  }
  return vectors;
}

/**
 * General-purpose CampusSage answer generation. Documents are optional context,
 * not a restriction. Conversation history is included so follow-up questions
 * can be answered naturally.
 */
export async function generateAnswer(question, sources = [], history = []) {
  const apiKey = requireApiKey();
  const prompt = buildPrompt(question, sources, history);
  const response = await fetch(`${API_BASE}/models/${CHAT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 4096,
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini chat request failed (${response.status}): ${await safeText(response)}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!text.trim()) throw new Error("Gemini returned an empty response.");
  return text.trim();
}

function buildPrompt(question, sources, history) {
  const historyText = history.length
    ? history.map((message) => `${message.role === "assistant" ? "CampusSage" : "Student"}: ${message.content}`).join("\n")
    : "(No previous conversation.)";

  const contextText = sources.length
    ? sources.map((source, index) =>
        `[Source ${index + 1}: ${source.label}, page ${source.page || 1}, semester ${source.semester || "Unassigned"}, subject ${source.subject || "Unassigned"}]\n${source.text}`
      ).join("\n\n")
    : "(No sufficiently relevant uploaded-document context was found.)";

  return [
    "You are CampusSage AI, a capable general-purpose AI assistant for a college student.",
    "You can answer academic questions from any subject as well as normal general questions.",
    "Uploaded documents are OPTIONAL supporting context, not a restriction on what you can answer.",
    "",
    "Rules:",
    "1. Answer the student's actual question directly using your general knowledge.",
    "2. Use uploaded-document context when it is relevant to the question.",
    "3. Never claim that you cannot answer merely because the uploaded documents do not contain the topic.",
    "4. If relevant document context is used, cite it inline as [Source 1], [Source 2], etc.",
    "5. If the student explicitly asks 'according to my document/notes', prioritize the supplied documents. If they do not contain the requested information, clearly say that the documents do not cover it instead of inventing a document-based answer.",
    "6. Do not force unrelated retrieved text into the answer. Retrieved context can be irrelevant or only partially relevant.",
    "7. Use conversation history to understand follow-up questions and references such as 'it', 'that', or 'explain more'.",
    "8. Be accurate, clear, and appropriately detailed. Use Markdown when useful.",
    "",
    "Recent conversation:",
    historyText,
    "",
    "Optional uploaded-document context:",
    contextText,
    "",
    `Current question: ${question}`,
  ].join("\n");
}

function requireApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server.");
  return apiKey;
}

async function safeText(response) {
  try { return await response.text(); } catch { return "<no response body>"; }
}

/**
 * Extracts timetable entries from a timetable image or PDF.
 *
 * IMPORTANT: this parser is layout-agnostic. The model is told to first
 * understand the visual structure of the supplied timetable instead of
 * assuming that days are columns, periods are rows, or that clock times are
 * present. It supports period-based, clock-time-based, horizontal, vertical,
 * rotated, merged-cell and course-code/legend layouts.
 */
export async function extractTimetableFromFile(buffer, mimeType) {
  const apiKey = requireApiKey();
  const supported = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];
  if (!supported.includes(mimeType)) {
    throw new Error("Unsupported timetable file type. Use a common image format (JPG, PNG, WEBP, HEIC) or PDF.");
  }

  const prompt = [
    "You are a highly reliable timetable-understanding engine for CampusSage AI.",
    "Your job is to visually understand ANY academic timetable layout supplied as an image or PDF and convert only the scheduled classes into structured JSON.",
    "Do NOT assume a particular college, template, orientation, number of periods, day order, language, or table design.",
    "",
    "FIRST understand the document visually:",
    "1. Locate the actual weekly schedule, even if it is above, below, beside, rotated, split across sections, or arranged horizontally/vertically.",
    "2. Determine whether days are rows, columns, headers, labels, or another arrangement.",
    "3. Determine whether time is represented by explicit clock times, time ranges, period numbers, Roman numerals, named slots, or another repeated slot system.",
    "4. Detect row/column spans and merged cells. A merged cell represents one class covering every slot it spans.",
    "5. Look for a course-code legend or subject list elsewhere in the document and use it only to decode codes found in the weekly schedule.",
    "6. Ignore institutional headers, logos, academic-year information, semester/branch labels, faculty/course-list tables, signatures, totals and other non-schedule content unless it is necessary to interpret the schedule.",
    "",
    "Return ONLY valid JSON with this shape:",
    '{"entries":[{"day":"Tue","period":1,"endPeriod":1,"startTime":"","endTime":"","subject":"22CS930 - Enterprise Cyber Security","room":"","faculty":"","type":"Theory"}],"warnings":[]}',
    "",
    "DAY RULES:",
    "- Normalize full or abbreviated day names to exactly Mon, Tue, Wed, Thu, Fri, Sat, Sun.",
    "- Understand day names regardless of whether they appear as rows or columns.",
    "- Do not invent a day when it is not actually associated with a scheduled cell.",
    "",
    "TIME RULES:",
    "- If exact clock times are visible anywhere in the schedule, extract the real startTime and endTime as HH:MM. Do not replace visible times with defaults.",
    "- Understand common time styles such as 9 AM, 09:00 AM, 9.00-9.50, 09:00–09:50 and similar visual representations.",
    "- If the schedule uses numbered, Roman-numeral, lettered, or named periods instead of clock times, return period and endPeriod and leave startTime/endTime empty.",
    "- period is the first occupied slot and endPeriod is the last occupied slot for the same class.",
    "- If a class spans multiple adjacent slots, return ONE entry, not one entry per slot.",
    "- Never invent exact clock times when the source only provides period/slot labels.",
    "",
    "SUBJECT RULES:",
    "- Preserve the subject/course text visible in the schedule.",
    "- If a code is shown and a course legend is available, combine them as 'CODE - Course Name'.",
    "- If no legend is available, preserve the code exactly rather than guessing its meaning.",
    "- Preserve scheduled activities such as Lab, Tutorial, Seminar, Project, Sports, Library, Training, Placement, GD, Mock, Break or similar ONLY when they are actual scheduled cells. Ignore cells explicitly marked free/blank/lunch/break when they are not classes.",
    "",
    "OTHER FIELDS:",
    "- Extract room and faculty only when clearly associated with the class.",
    "- Use type Lab when the class is clearly a laboratory, Tutorial when clearly a tutorial, otherwise Theory.",
    "- Do not invent room names, faculty names, subjects or times.",
    "",
    "QUALITY RULES:",
    "- Read the complete supplied image/PDF, including small text and lower/upper tables.",
    "- Do not confuse the course legend with the weekly schedule.",
    "- Do not require the timetable to look like a grid with days across the top.",
    "- If the schedule uses multiple tables or sections, combine their actual scheduled classes.",
    "- If the same class is visibly repeated in separate slots, return separate entries for each occurrence unless the source shows one merged span.",
    "- If a cell is unreadable, leave uncertain optional fields empty rather than hallucinating.",
    "- If no scheduled classes can be reliably identified, return {\"entries\":[],\"warnings\":[\"No reliable schedule cells were detected.\"]}.",
  ].join("\n");

  const response = await fetch(`${API_BASE}/models/${CHAT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: buffer.toString("base64") } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini timetable extraction failed (${response.status}): ${await safeText(response)}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!raw.trim()) throw new Error("Gemini returned no timetable data.");

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The timetable could not be converted into structured data. Please upload a clearer image or PDF.");
    }
  }

  return normalizeTimetableEntries(parsed?.entries);
}

function normalizeTimetableEntries(entries) {
  if (!Array.isArray(entries)) return [];

  const dayMap = new Map([
    ["mon", "Mon"], ["monday", "Mon"],
    ["tue", "Tue"], ["tues", "Tue"], ["tuesday", "Tue"],
    ["wed", "Wed"], ["wednesday", "Wed"],
    ["thu", "Thu"], ["thur", "Thu"], ["thurs", "Thu"], ["thursday", "Thu"],
    ["fri", "Fri"], ["friday", "Fri"],
    ["sat", "Sat"], ["saturday", "Sat"],
    ["sun", "Sun"], ["sunday", "Sun"],
  ]);

  const types = new Set(["Theory", "Lab", "Tutorial"]);
  const firstPeriodMinutes = Number(process.env.TIMETABLE_FIRST_PERIOD_MINUTES || 8 * 60);
  const periodDuration = Number(process.env.TIMETABLE_PERIOD_MINUTES || 60);

  return entries.map((entry) => {
    const rawDay = String(entry?.day || "").trim().toLowerCase().replace(/\s+/g, " ");
    const day = dayMap.get(rawDay) || dayMap.get(rawDay.slice(0, 3)) || null;

    let startTime = normalizeTime(entry?.startTime);
    let endTime = normalizeTime(entry?.endTime);
    const period = parsePeriod(entry?.period);
    const endPeriod = parsePeriod(entry?.endPeriod ?? entry?.period);

    if (!startTime && Number.isInteger(period) && period >= 1 && Number.isInteger(endPeriod) && endPeriod >= period) {
      const startMinutes = firstPeriodMinutes + (period - 1) * periodDuration;
      const endMinutes = firstPeriodMinutes + endPeriod * periodDuration;
      startTime = minutesToTime(startMinutes);
      endTime = minutesToTime(endMinutes);
    }

    return {
      day,
      startTime,
      endTime,
      subject: String(entry?.subject || "").trim(),
      room: String(entry?.room || "").trim(),
      faculty: String(entry?.faculty || "").trim(),
      type: types.has(entry?.type) ? entry.type : "Theory",
      period,
      endPeriod,
    };
  }).filter((entry) =>
    entry.day && entry.startTime && entry.endTime && entry.subject && entry.startTime < entry.endTime
  );
}

function parsePeriod(value) {
  if (Number.isInteger(value)) return value;
  const text = String(value ?? "").trim().toUpperCase();
  if (/^\d+$/.test(text)) return Number(text);
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  return roman[text] || null;
}

function minutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeTime(value) {
  const text = String(value || "").trim().toUpperCase().replace(/\./g, ":");
  if (!text) return null;

  let match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3];

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "AM") hour = hour === 12 ? 0 : hour;
    if (meridiem === "PM") hour = hour === 12 ? 12 : hour + 12;
  } else if (hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
