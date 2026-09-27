import { useMemo, useRef, useState } from "react";
import { BookOpen, CloudUpload, FileSearch, FolderOpen, Layers } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import Modal from "../components/common/Modal";
import { Input, Select } from "../components/common/Input";
import SectionHeader from "../components/common/SectionHeader";
import DocumentCard from "../components/library/DocumentCard";
import { useApp } from "../context/AppContext";
import { openDocumentFile } from "../services/documentService";

const semesters = Array.from({ length: 8 }, (_, index) => `Semester ${index + 1}`);
const categories = ["Uploaded", "Notes", "Lab Manual", "Syllabus", "Question Paper", "Regulations", "Circular", "Placement", "Other"];

function normalizeSemester(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:semester|sem)[\s-]*(\d+)/i) || text.match(/^(\d+)$/);
  return match ? `Semester ${match[1]}` : "Unassigned";
}

export default function Library() {
  const {
    documents,
    profile,
    addDocuments,
    organizeDocument,
    renameDocument,
    removeDocument,
    uploadProgress,
  } = useApp();

  const currentSemester = normalizeSemester(profile?.semester);
  const [activeSemester, setActiveSemester] = useState(currentSemester !== "Unassigned" ? currentSemester : "All");
  const [activeSubject, setActiveSubject] = useState("All");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [renamingDocument, setRenamingDocument] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [organizingDocument, setOrganizingDocument] = useState(null);
  const [organization, setOrganization] = useState({ semester: currentSemester !== "Unassigned" ? currentSemester : "Semester 1", subject: "", category: "Uploaded" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadMeta, setUploadMeta] = useState({ semester: currentSemester !== "Unassigned" ? currentSemester : "Semester 1", subject: "", category: "Uploaded" });
  const uploadInputRef = useRef(null);

  const profileSubjects = useMemo(
    () => (Array.isArray(profile?.subjects) ? profile.subjects.map((item) => String(item).trim()).filter(Boolean) : []),
    [profile?.subjects]
  );

  const subjectsForSemester = useMemo(() => {
    const values = new Set(profileSubjects);
    documents.forEach((doc) => {
      if (normalizeSemester(doc.semester) === activeSemester && doc.subject && doc.subject !== "Unassigned") values.add(doc.subject);
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [documents, profileSubjects, activeSemester]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const docSemester = normalizeSemester(doc.semester);
      const matchesSemester = activeSemester === "All" ? true : docSemester === activeSemester;
      const matchesSubject = activeSubject === "All" ? true : String(doc.subject || "").toLowerCase() === activeSubject.toLowerCase();
      const matchesCategory = category === "All" || doc.type === category || doc.category === category;
      const haystack = `${doc.name} ${doc.subject || ""} ${doc.semester || ""}`.toLowerCase();
      return matchesSemester && matchesSubject && matchesCategory && (!query || haystack.includes(query));
    });
  }, [documents, activeSemester, activeSubject, category, search]);

  const semesterCounts = useMemo(() => semesters.map((semester) => ({
    semester,
    count: documents.filter((doc) => normalizeSemester(doc.semester) === semester).length,
    subjects: new Set(documents.filter((doc) => normalizeSemester(doc.semester) === semester && doc.subject && doc.subject !== "Unassigned").map((doc) => doc.subject)).size,
  })), [documents]);

  function selectSemester(value) {
    setActiveSemester(value);
    setActiveSubject("All");
  }

  function openOrganizer(doc) {
    setOrganizingDocument(doc);
    setOrganization({
      semester: normalizeSemester(doc.semester) === "Unassigned" ? (currentSemester !== "Unassigned" ? currentSemester : "Semester 1") : normalizeSemester(doc.semester),
      subject: doc.subject === "Unassigned" ? "" : doc.subject,
      category: doc.category || "Uploaded",
    });
  }

  async function saveOrganization(event) {
    event.preventDefault();
    if (!organization.subject.trim()) return;
    await organizeDocument(organizingDocument.id, organization);
    setOrganizingDocument(null);
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (!uploadFiles.length || !uploadMeta.subject.trim()) return;
    await addDocuments(uploadFiles, uploadMeta);
    setUploadFiles([]);
    setUploadOpen(false);
  }

  function openUpload() {
    setUploadMeta({
      semester: currentSemester !== "Unassigned" ? currentSemester : (activeSemester !== "All" ? activeSemester : "Semester 1"),
      subject: activeSubject !== "All" ? activeSubject : "",
      category: "Uploaded",
    });
    setUploadFiles([]);
    setUploadOpen(true);
  }

  return (
    <div className="cs-page-stack">
      <SectionHeader
        title="My Library"
        subtitle="Organize your academic documents by semester and subject"
        action={<Button variant="secondary" onClick={openUpload}><CloudUpload size={16} /> Upload</Button>}
      />

      <Card className="cs-library__toolbar">
        <Input label="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by document, semester or subject..." />
        <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </Card>

      <div className="cs-library__semester-nav">
        <button type="button" className={`cs-library__semester-card ${activeSemester === "All" ? "is-active" : ""}`} onClick={() => selectSemester("All")}>
          <Layers size={18} />
          <strong>All</strong>
          <span>{documents.length} documents</span>
        </button>
        {semesterCounts.map(({ semester, count, subjects }) => (
          <button key={semester} type="button" className={`cs-library__semester-card ${activeSemester === semester ? "is-active" : ""}`} onClick={() => selectSemester(semester)}>
            <BookOpen size={18} />
            <strong>{semester.replace("Semester ", "Sem ")}</strong>
            <span>{count} docs · {subjects} subjects</span>
          </button>
        ))}
      </div>

      {activeSemester !== "All" ? (
        <div className="cs-library__sticky-nav">
          <div>
            <span className="cs-library__eyebrow">ACADEMIC DOCUMENTS</span>
            <h2>{activeSemester}</h2>
          </div>
          <div className="cs-library__subject-tabs">
            <button type="button" className={activeSubject === "All" ? "is-active" : ""} onClick={() => setActiveSubject("All")}>All Subjects</button>
            {subjectsForSemester.map((subject) => (
              <button key={subject} type="button" className={activeSubject === subject ? "is-active" : ""} onClick={() => setActiveSubject(subject)}>{subject}</button>
            ))}
          </div>
        </div>
      ) : null}

      {activeSemester === "All" ? (
        <div className="cs-library__overview-grid">
          {semesterCounts.map(({ semester, count, subjects }) => (
            <button key={semester} type="button" className="cs-library__overview-card" onClick={() => selectSemester(semester)}>
              <FolderOpen size={20} />
              <strong>{semester}</strong>
              <span>{count} documents · {subjects} subjects</span>
              <em>View semester →</em>
            </button>
          ))}
          <button type="button" className="cs-library__overview-card" onClick={() => setActiveSemester("Unassigned")}>
            <FileSearch size={20} />
            <strong>Unassigned</strong>
            <span>{documents.filter((doc) => normalizeSemester(doc.semester) === "Unassigned").length} documents</span>
            <em>Organize →</em>
          </button>
        </div>
      ) : null}

      {activeSemester !== "All" ? (
        filteredDocuments.length ? (
          <div className="cs-document-grid">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onPreview={setPreviewDocument}
                onRename={(item) => { setRenamingDocument(item); setRenameValue(item.name); }}
                onDelete={removeDocument}
                onOrganize={openOrganizer}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No documents in this view" description="Upload a document or change the semester, subject, search, or category filter." icon={FileSearch} />
        )
      ) : null}

      {uploadProgress > 0 ? <Card className="cs-progress-card"><div className="cs-progress-card__bar" style={{ width: `${uploadProgress}%` }} /></Card> : null}

      <Modal open={uploadOpen} title="Upload academic documents" onClose={() => setUploadOpen(false)}>
        <form className="cs-modal-form" onSubmit={submitUpload}>
          <Select label="Semester" value={uploadMeta.semester} onChange={(event) => setUploadMeta((v) => ({ ...v, semester: event.target.value }))}>
            {semesters.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <Input label="Subject" list="campussage-subjects" value={uploadMeta.subject} onChange={(event) => setUploadMeta((v) => ({ ...v, subject: event.target.value }))} placeholder="e.g. Database Management Systems" required />
          <datalist id="campussage-subjects">{profileSubjects.map((item) => <option key={item} value={item} />)}</datalist>
          <Select label="Category" value={uploadMeta.category} onChange={(event) => setUploadMeta((v) => ({ ...v, category: event.target.value }))}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </Select>
          <label className="cs-library__file-picker">
            <span>Documents</span>
            <input ref={uploadInputRef} type="file" multiple accept=".pdf,.docx,.pptx" onChange={(event) => setUploadFiles(Array.from(event.target.files || []))} />
            {uploadFiles.length ? <small>{uploadFiles.map((file) => file.name).join(", ")}</small> : <small>Choose PDF, DOCX or PPTX files</small>}
          </label>
          <div className="cs-form-grid__actions">
            <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!uploadFiles.length || !uploadMeta.subject.trim()}><CloudUpload size={16} /> Upload & index</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(organizingDocument)} title="Organize document" onClose={() => setOrganizingDocument(null)}>
        {organizingDocument ? (
          <form className="cs-modal-form" onSubmit={saveOrganization}>
            <p><strong>{organizingDocument.name}</strong></p>
            <Select label="Semester" value={organization.semester} onChange={(event) => setOrganization((v) => ({ ...v, semester: event.target.value }))}>
              {semesters.map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Input label="Subject" list="campussage-organize-subjects" value={organization.subject} onChange={(event) => setOrganization((v) => ({ ...v, subject: event.target.value }))} required />
            <datalist id="campussage-organize-subjects">{profileSubjects.map((item) => <option key={item} value={item} />)}</datalist>
            <Select label="Category" value={organization.category} onChange={(event) => setOrganization((v) => ({ ...v, category: event.target.value }))}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Button type="submit">Save organization</Button>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(previewDocument)} title={previewDocument?.name || "Preview"} onClose={() => setPreviewDocument(null)}>
        {previewDocument ? (
          <div className="cs-document-preview">
            <p><strong>Semester:</strong> {normalizeSemester(previewDocument.semester)}</p>
            <p><strong>Subject:</strong> {previewDocument.subject || "Unassigned"}</p>
            <p><strong>Type:</strong> {previewDocument.type}</p>
            <p><strong>Category:</strong> {previewDocument.category}</p>
            <p><strong>Size:</strong> {previewDocument.size}</p>
            <p><strong>Status:</strong> {previewDocument.status}</p>
            <Button onClick={() => openDocumentFile(previewDocument.id)}>Open stored file</Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(renamingDocument)} title="Rename document" onClose={() => setRenamingDocument(null)}>
        <form className="cs-modal-form" onSubmit={(event) => { event.preventDefault(); renameDocument(renamingDocument.id, renameValue); setRenamingDocument(null); }}>
          <Input label="Document name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          <Button type="submit">Save changes</Button>
        </form>
      </Modal>
    </div>
  );
}
