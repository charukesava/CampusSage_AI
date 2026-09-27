import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  LogIn,
  Send,
  Paperclip,
  Pin,
  PinOff,
  Trash2,
  Megaphone,
  Users,
  Copy,
  X,
  UserMinus,
  UserPlus,
  Eye,
  Download,
  Search,
} from "lucide-react";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import EmptyState from "../components/common/EmptyState";
import SectionHeader from "../components/common/SectionHeader";
import { Input } from "../components/common/Input";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";
import {
  getSubjects,
  createSubject,
  joinSubject,
  getSubjectMessages,
  sendSubjectMessage,
  togglePinMessage,
  deleteSubjectMessage,
  getSubjectMembers,
  removeSubjectMember,
  addSubjectMember,
  searchStudents,
  fetchAttachmentBlob,
} from "../services/campusConnectService";

const POLL_INTERVAL_MS = 4000;

export default function CampusConnect() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  const [subjects, setSubjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", semester: "" });
  const [joinCode, setJoinCode] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [announceMode, setAnnounceMode] = useState(false);
  const [sending, setSending] = useState(false);

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);

  const [preview, setPreview] = useState(null);
  const [attachmentBusyId, setAttachmentBusyId] = useState(null);

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);
  const messageRefs = useRef({});

  const activeSubject = subjects.find((s) => s.id === activeId) || null;
  const pinnedMessages = messages.filter((m) => m.pinned);

  const loadSubjects = useCallback(async (preferId) => {
    try {
      const data = await getSubjects();
      setSubjects(data);
      if (data.length) {
        setActiveId((current) => preferId || current || data[0].id);
      } else {
        setActiveId(null);
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const loadMessages = useCallback(async (subjectId, { silent } = {}) => {
    if (!subjectId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const data = await getSubjectMessages(subjectId);
      setMessages(data);
    } catch (err) {
      if (!silent) setError(getApiError(err));
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    loadMessages(activeId);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(activeId, { silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [activeId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function handleCreateSubject(event) {
    event.preventDefault();
    setFormError("");
    if (!createForm.name.trim()) return setFormError("Give the subject a name.");
    setSubmitting(true);
    try {
      const subject = await createSubject(createForm);
      setShowCreate(false);
      setCreateForm({ name: "", semester: "" });
      await loadSubjects(subject.id);
    } catch (err) {
      setFormError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinSubject(event) {
    event.preventDefault();
    setFormError("");
    if (!joinCode.trim()) return setFormError("Enter a join code.");
    setSubmitting(true);
    try {
      const subject = await joinSubject(joinCode.trim());
      setShowJoin(false);
      setJoinCode("");
      await loadSubjects(subject.id);
    } catch (err) {
      setFormError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!activeId || (!draft.trim() && !attachment)) return;
    setSending(true);
    setError("");
    try {
      const message = await sendSubjectMessage(activeId, {
        content: draft.trim(),
        isAnnouncement: isTeacher && activeSubject?.isOwner && announceMode,
        file: attachment,
      });
      setMessages((current) => [...current, message]);
      setDraft("");
      setAttachment(null);
      setAnnounceMode(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleTogglePin(message) {
    try {
      const updated = await togglePinMessage(activeId, message.id, !message.pinned);
      setMessages((current) =>
        [...current.filter((m) => m.id !== updated.id), updated].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        })
      );
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function handleDelete(message) {
    try {
      await deleteSubjectMessage(activeId, message.id);
      setMessages((current) => current.filter((m) => m.id !== message.id));
    } catch (err) {
      setError(getApiError(err));
    }
  }

  function copyJoinCode() {
    if (activeSubject?.joinCode) navigator.clipboard?.writeText(activeSubject.joinCode);
  }

  function scrollToMessage(messageId) {
    messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function openMembers() {
    setShowMembers(true);
    setStudentQuery("");
    setStudentResults([]);
    setMembersLoading(true);
    try {
      setMembers(await getSubjectMembers(activeId));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setMembersLoading(false);
    }
  }

  async function handleRemoveMember(memberUserId) {
    try {
      await removeSubjectMember(activeId, memberUserId);
      setMembers((current) => current.filter((m) => m.userId !== memberUserId));
      setSubjects((current) =>
        current.map((s) => (s.id === activeId ? { ...s, memberCount: Math.max(1, (s.memberCount || 1) - 1) } : s))
      );
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function handleStudentSearch(query) {
    setStudentQuery(query);
    if (query.trim().length < 2) return setStudentResults([]);
    setStudentSearchLoading(true);
    try {
      const results = await searchStudents(query.trim());
      setStudentResults(results);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setStudentSearchLoading(false);
    }
  }

  async function handleAddMember(studentId) {
    try {
      const member = await addSubjectMember(activeId, studentId);
      setMembers((current) => (current.some((m) => m.userId === member.userId) ? current : [...current, member]));
      setStudentResults((current) => current.filter((s) => s.id !== studentId));
      setSubjects((current) =>
        current.map((s) => (s.id === activeId ? { ...s, memberCount: (s.memberCount || 1) + 1 } : s))
      );
    } catch (err) {
      setError(getApiError(err));
    }
  }

  async function handleAttachmentAction(message, mode) {
    setAttachmentBusyId(message.id);
    try {
      const blob = await fetchAttachmentBlob(activeId, message.id);
      const url = URL.createObjectURL(blob);
      if (mode === "preview") {
        setPreview({ url, mimeType: message.attachment.mimeType, name: message.attachment.name });
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = message.attachment.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setAttachmentBusyId(null);
    }
  }

  const canManage = (message) => message.senderId === user?.id || activeSubject?.isOwner;
  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <div className="cs-page-stack">
      <SectionHeader
        title="CampusConnect"
        subtitle={
          isTeacher
            ? "Run your subject spaces — announcements, roster, and student chat in one place"
            : "Academic communication, connected to your subjects and documents"
        }
        action={
          isTeacher ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New subject
            </Button>
          ) : (
            <Button onClick={() => setShowJoin(true)}>
              <LogIn size={16} /> Join with code
            </Button>
          )
        }
      />

      {error ? <div className="cs-auth__error" role="alert">{error}</div> : null}

      {loadingSubjects ? (
        <Card>Loading your subjects...</Card>
      ) : !subjects.length ? (
        <EmptyState
          title={isTeacher ? "Create your first subject space" : "You haven't joined any subject yet"}
          description={
            isTeacher
              ? "Create a subject to start posting announcements, sharing material, and chatting with your students."
              : "Ask your teacher for a join code, then use \"Join with code\" above to enter a subject space."
          }
          actionLabel={isTeacher ? "New subject" : "Join with code"}
          onAction={() => (isTeacher ? setShowCreate(true) : setShowJoin(true))}
          icon={Users}
        />
      ) : (
        <div className="cs-connect">
          <Card className="cs-connect__sidebar">
            <div className="cs-connect__sidebar-list">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  className={`cs-connect__subject ${subject.id === activeId ? "is-active" : ""}`}
                  onClick={() => setActiveId(subject.id)}
                >
                  <div className="cs-connect__subject-name">{subject.name}</div>
                  <div className="cs-connect__subject-meta">
                    {subject.semester ? `${subject.semester} · ` : ""}
                    {subject.isOwner ? "You teach this" : subject.teacherName}
                  </div>
                </button>
              ))}
            </div>
            {!isTeacher ? (
              <Button variant="secondary" className="cs-connect__join-btn" onClick={() => setShowJoin(true)}>
                <LogIn size={15} /> Join another subject
              </Button>
            ) : null}
          </Card>

          <Card className="cs-connect__thread">
            {activeSubject ? (
              <>
                <div className="cs-connect__thread-header">
                  <div>
                    <h3>{activeSubject.name}</h3>
                    <button className="cs-connect__thread-meta cs-connect__members-btn" onClick={openMembers}>
                      <Users size={13} /> {activeSubject.memberCount || 1} member{activeSubject.memberCount === 1 ? "" : "s"}
                    </button>
                  </div>
                  {activeSubject.isOwner ? (
                    <button className="cs-connect__join-code" onClick={copyJoinCode} title="Copy join code">
                      Join code: <strong>{activeSubject.joinCode}</strong> <Copy size={13} />
                    </button>
                  ) : null}
                </div>

                {pinnedMessages.length ? (
                  <div className="cs-connect__pinned-bar">
                    <Pin size={13} />
                    <div className="cs-connect__pinned-list">
                      {pinnedMessages.map((message) => (
                        <button key={message.id} onClick={() => scrollToMessage(message.id)}>
                          <strong>{message.senderName}:</strong> {message.content || message.attachment?.name || "Attachment"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="cs-connect__messages" ref={scrollRef}>
                  {loadingMessages ? (
                    <div className="cs-connect__loading">Loading messages...</div>
                  ) : messages.length ? (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        ref={(el) => { messageRefs.current[message.id] = el; }}
                        className={`cs-connect__message ${message.senderId === user?.id ? "is-own" : ""} ${
                          message.isAnnouncement ? "is-announcement" : ""
                        } ${message.pinned ? "is-pinned" : ""}`}
                      >
                        <div className="cs-connect__message-head">
                          <span className="cs-connect__message-sender">{message.senderName}</span>
                          {message.senderRole === "teacher" ? <Badge tone="info">Teacher</Badge> : null}
                          {message.isAnnouncement ? (
                            <Badge tone="warning">
                              <Megaphone size={12} /> Announcement
                            </Badge>
                          ) : null}
                          {message.pinned ? <Pin size={13} className="cs-connect__pin-icon" /> : null}
                          <span className="cs-connect__message-time">
                            {new Date(message.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {message.content ? <p className="cs-connect__message-body">{message.content}</p> : null}
                        {message.attachment ? (
                          <div className="cs-connect__attachment-row">
                            <span className="cs-connect__attachment-name">
                              <Paperclip size={14} /> {message.attachment.name}
                            </span>
                            <div className="cs-connect__attachment-buttons">
                              {message.attachment.mimeType?.startsWith("image/") || message.attachment.mimeType === "application/pdf" ? (
                                <button
                                  disabled={attachmentBusyId === message.id}
                                  onClick={() => handleAttachmentAction(message, "preview")}
                                  title="Preview"
                                >
                                  <Eye size={13} /> Preview
                                </button>
                              ) : null}
                              <button
                                disabled={attachmentBusyId === message.id}
                                onClick={() => handleAttachmentAction(message, "download")}
                                title="Download"
                              >
                                <Download size={13} /> Download
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="cs-connect__message-actions">
                          {activeSubject.isOwner ? (
                            <button onClick={() => handleTogglePin(message)} title={message.pinned ? "Unpin" : "Pin"}>
                              {message.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                            </button>
                          ) : null}
                          {canManage(message) ? (
                            <button onClick={() => handleDelete(message)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="cs-connect__loading">No messages yet. Say hello 👋</div>
                  )}
                </div>

                <form className="cs-connect__composer" onSubmit={handleSend}>
                  {attachment ? (
                    <div className="cs-connect__attachment-chip">
                      <Paperclip size={13} /> {attachment.name}
                      <button type="button" onClick={() => setAttachment(null)}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : null}
                  <div className="cs-connect__composer-row">
                    <button
                      type="button"
                      className="cs-icon-button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach a file"
                    >
                      <Paperclip size={17} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                    />
                    <textarea
                      className="cs-input cs-connect__composer-input"
                      placeholder={
                        isTeacher && activeSubject.isOwner && announceMode
                          ? "Write an announcement to the class..."
                          : "Type a message..."
                      }
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend(event);
                        }
                      }}
                      rows={1}
                    />
                    <Button type="submit" disabled={sending || (!draft.trim() && !attachment)}>
                      <Send size={15} />
                    </Button>
                  </div>
                  {isTeacher && activeSubject.isOwner ? (
                    <label className="cs-connect__announce-toggle">
                      <input
                        type="checkbox"
                        checked={announceMode}
                        onChange={(event) => setAnnounceMode(event.target.checked)}
                      />
                      <Megaphone size={13} /> Post as announcement
                    </label>
                  ) : null}
                </form>
              </>
            ) : (
              <EmptyState title="Select a subject" description="Pick a subject from the left to see its conversation." />
            )}
          </Card>
        </div>
      )}

      <Modal open={showCreate} title="Create a subject" onClose={() => setShowCreate(false)}>
        <form className="cs-auth__form" onSubmit={handleCreateSubject}>
          <Input
            label="Subject name"
            placeholder="e.g. Cryptography"
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            label="Semester (optional)"
            placeholder="e.g. Semester 7"
            value={createForm.semester}
            onChange={(event) => setCreateForm((current) => ({ ...current, semester: event.target.value }))}
          />
          {formError ? <div className="cs-auth__error" role="alert">{formError}</div> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create subject"}
          </Button>
        </form>
      </Modal>

      <Modal open={showJoin} title="Join a subject" onClose={() => setShowJoin(false)}>
        <form className="cs-auth__form" onSubmit={handleJoinSubject}>
          <Input
            label="Join code"
            placeholder="e.g. AB3XQ9"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          />
          {formError ? <div className="cs-auth__error" role="alert">{formError}</div> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Joining..." : "Join subject"}
          </Button>
        </form>
      </Modal>

      <Modal open={showMembers} title={`${activeSubject?.name || "Subject"} members`} onClose={() => setShowMembers(false)} width="medium">
        {activeSubject?.isOwner ? (
          <div className="cs-connect__add-student">
            <div className="cs-connect__add-student-search">
              <Search size={15} />
              <input
                className="cs-input"
                placeholder="Search students by name or roll number..."
                value={studentQuery}
                onChange={(event) => handleStudentSearch(event.target.value)}
              />
            </div>
            {studentSearchLoading ? <p className="cs-connect__loading">Searching...</p> : null}
            {studentResults.length ? (
              <div className="cs-connect__student-results">
                {studentResults
                  .filter((s) => !memberIds.has(s.id))
                  .map((student) => (
                    <div key={student.id} className="cs-connect__student-row">
                      <div>
                        <div className="cs-connect__student-name">{student.name}</div>
                        <div className="cs-connect__student-meta">
                          {student.registerNumber ? `${student.registerNumber} · ` : ""}
                          {student.semester || "—"}
                        </div>
                      </div>
                      <Button variant="secondary" onClick={() => handleAddMember(student.id)}>
                        <UserPlus size={14} /> Add
                      </Button>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {membersLoading ? (
          <p className="cs-connect__loading">Loading members...</p>
        ) : (
          <div className="cs-connect__member-list">
            {members.map((member) => (
              <div key={member.userId} className="cs-connect__student-row">
                <div>
                  <div className="cs-connect__student-name">
                    {member.name} {member.isOwner ? <Badge tone="info">Teacher</Badge> : null}
                  </div>
                  {activeSubject?.isOwner && !member.isOwner ? (
                    <div className="cs-connect__student-meta">
                      {member.registerNumber ? `${member.registerNumber} · ` : ""}
                      {member.semester || "—"}
                    </div>
                  ) : null}
                </div>
                {activeSubject?.isOwner && !member.isOwner ? (
                  <Button variant="danger" onClick={() => handleRemoveMember(member.userId)}>
                    <UserMinus size={14} /> Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={Boolean(preview)} title={preview?.name || "Preview"} onClose={() => setPreview(null)} width="large">
        {preview?.mimeType?.startsWith("image/") ? (
          <img src={preview.url} alt={preview.name} className="cs-connect__preview-image" />
        ) : preview?.mimeType === "application/pdf" ? (
          <iframe src={preview.url} title={preview.name} className="cs-connect__preview-pdf" />
        ) : null}
      </Modal>
    </div>
  );
}
