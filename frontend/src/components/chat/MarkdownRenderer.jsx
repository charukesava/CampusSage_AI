function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

export default function MarkdownRenderer({ content }) {
  if (!content) {
    return null;
  }

  const blocks = [];
  const lines = content.split("\n");
  let codeBuffer = [];
  let listBuffer = [];
  let paragraphBuffer = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push(`<p>${paragraphBuffer.map(renderInline).join("<br />")}</p>`);
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push(
        `<ul>${listBuffer.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      listBuffer = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(
          `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`,
        );
        codeBuffer = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }

    flushList();

    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push(`<h3>${renderInline(line.slice(2))}</h3>`);
    } else if (line.trim()) {
      paragraphBuffer.push(line);
    } else {
      flushParagraph();
    }
  }

  flushParagraph();
  flushList();

  return (
    <div
      className="cs-markdown"
      dangerouslySetInnerHTML={{ __html: blocks.join("") }}
    />
  );
}
