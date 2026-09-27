import { Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";
import Badge from "../common/Badge";
import MarkdownRenderer from "./MarkdownRenderer";

export default function ChatMessage({ message, onRegenerate, onCopy }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopy(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className={`cs-message cs-message--${message.role}`}>
      <div className="cs-message__bubble">
        <MarkdownRenderer content={message.content} />
        {message.citations?.length ? (
          <div className="cs-message__citations">
            <Badge tone="info">Source document</Badge>
            {message.citations.map((citation) => (
              <span
                key={`${citation.documentId}-${citation.page}`}
                className="cs-message__citation"
              >
                {citation.label} • Page {citation.page}
              </span>
            ))}
          </div>
        ) : null}
        {message.role === "assistant" ? (
          <div className="cs-message__actions">
            <button onClick={handleCopy}>
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={onRegenerate}>
              <RotateCcw size={14} /> Regenerate
            </button>
          </div>
        ) : null}
      </div>
      {message.role === "assistant" ? (
        <div className="cs-message__check">
          <Check size={14} />
        </div>
      ) : null}
    </article>
  );
}
