import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";

/**
 * Extracts text from an uploaded document, split into logical "pages" so we can
 * cite a page number back to the user later.
 *
 * @param {string} filePath absolute path to the stored file on disk
 * @param {"PDF"|"DOCX"|"PPTX"} fileType
 * @returns {Promise<{ pageCount: number|null, pages: { page: number, text: string }[] }>}
 */
export async function extractDocumentText(filePath, fileType) {
  if (fileType === "PDF") return extractPdf(filePath);
  if (fileType === "DOCX") return extractDocx(filePath);
  if (fileType === "PPTX") return extractPptx(filePath);
  throw new Error(`Unsupported file type for text extraction: ${fileType}`);
}

async function extractPdf(filePath) {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const pages = (result.pages || []).map((p) => ({ page: p.num, text: p.text || "" }));
    return { pageCount: result.total ?? pages.length, pages };
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(filePath) {
  const { value } = await mammoth.extractRawText({ path: filePath });
  // DOCX has no fixed pagination at the text level, so the whole document is
  // treated as a single logical "page"; the chunker below still splits it up.
  return { pageCount: null, pages: [{ page: 1, text: value || "" }] };
}

async function extractPptx(filePath) {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const pages = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    pages.push({ page: slideNumber(name), text: extractTextRunsFromSlideXml(xml) });
  }
  return { pageCount: pages.length, pages };
}

function slideNumber(fileName) {
  const match = fileName.match(/slide(\d+)\.xml/);
  return match ? Number(match[1]) : 0;
}

// PPTX slide XML wraps every visible text run in <a:t>...</a:t>. Pulling those
// out directly is the standard, dependency-light way to get slide text without
// needing a full XML DOM for every slide.
function extractTextRunsFromSlideXml(xml) {
  const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
  return runs.map((run) => decodeXmlEntities(run[1])).join(" ");
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
