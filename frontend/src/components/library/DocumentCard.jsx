import { Eye, FolderCog, Pencil, Trash2 } from "lucide-react";
import Badge from "../common/Badge";
import Button from "../common/Button";
import Card from "../common/Card";

export default function DocumentCard({
  document,
  onPreview,
  onRename,
  onDelete,
  onOrganize,
}) {
  return (
    <Card className="cs-document-card">
      <div className="cs-document-card__header">
        <div>
          <Badge tone="info">{document.type}</Badge>
          <h3>{document.name}</h3>
        </div>
        <div
          className={`cs-document-card__type cs-document-card__type--${document.type.toLowerCase()}`}
        >
          {document.type}
        </div>
      </div>
      <p>
        {document.subject && document.subject !== "Unassigned" ? `${document.subject} • ` : ""}
        {document.category} • {document.size} •{" "}
        {document.pages ? `${document.pages} pages` : "Indexed file"}
      </p>
      {document.status === "processing" ? (
        <Badge tone="warning">Indexing for AI search…</Badge>
      ) : document.status === "failed" ? (
        <Badge tone="danger">Indexing failed — try re-uploading</Badge>
      ) : null}
      <div className="cs-document-card__footer">
        <Button variant="ghost" onClick={() => onPreview(document)}>
          <Eye size={14} /> Preview
        </Button>
        {onOrganize ? <Button variant="ghost" onClick={() => onOrganize(document)}>
          <FolderCog size={14} /> Organize
        </Button> : null}
        <Button variant="ghost" onClick={() => onRename(document)}>
          <Pencil size={14} /> Rename
        </Button>
        <Button variant="danger" onClick={() => onDelete(document.id)}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </Card>
  );
}
