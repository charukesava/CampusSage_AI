import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Copy,
  Megaphone,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import Loader from "../components/common/Loader";
import SectionHeader from "../components/common/SectionHeader";
import StatCard from "../components/common/StatCard";
import { Select, Textarea } from "../components/common/Input";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { getApiError } from "../services/api";
import { getSubjects, searchStudents, sendSubjectMessage } from "../services/campusConnectService";

function QuickAccessCard({ title, description, icon: Icon, to }) {
  return (
    <Link to={to} className="cs-quick-access">
      <div className="cs-quick-access__icon">
        <Icon size={18} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <ArrowRight size={16} />
    </Link>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { profile, metrics } = useApp();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [error, setError] = useState("");

  const [announceSubjectId, setAnnounceSubjectId] = useState("");
  const [announceText, setAnnounceText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState("");

  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getSubjects()
      .then((data) => {
        setSubjects(data);
        const owned = data.find((s) => s.isOwner);
        if (owned) setAnnounceSubjectId(owned.id);
      })
      .catch((err) => setError(getApiError(err)))
      .finally(() => setLoadingSubjects(false));
  }, []);

  const ownedSubjects = useMemo(() => subjects.filter((s) => s.isOwner), [subjects]);
  const totalStudents = useMemo(
    () => ownedSubjects.reduce((sum, s) => sum + Math.max(0, (s.memberCount || 1) - 1), 0),
    [ownedSubjects]
  );

  async function handleAnnounce(event) {
    event.preventDefault();
    if (!announceSubjectId || !announceText.trim()) return;
    setSending(true);
    setSentNotice("");
    try {
      await sendSubjectMessage(announceSubjectId, { content: announceText.trim(), isAnnouncement: true });
      setAnnounceText("");
      setSentNotice("Announcement posted to CampusConnect.");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleStudentSearch(event) {
    event.preventDefault();
    if (studentQuery.trim().length < 2) return;
    setSearching(true);
    try {
      setStudentResults(await searchStudents(studentQuery.trim()));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSearching(false);
    }
  }

  function copyJoinCode(code) {
    navigator.clipboard?.writeText(code).catch(() => {});
  }

  return (
    <div className="cs-page-grid">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="cs-dashboard__hero"
      >
        <div>
          <Badge tone="info">Teacher workspace</Badge>
          <h2>Welcome back, {profile?.name || user?.name} 👋</h2>
          <p>Here's a quick overview of your classes and students.</p>
        </div>
        <Button onClick={() => navigate("/campus-connect")}>
          <MessageCircle size={16} /> Open CampusConnect
        </Button>
      </motion.section>

      <section className="cs-dashboard__stats">
        <StatCard
          label="Subjects Teaching"
          value={ownedSubjects.length}
          icon={BookOpen}
          tone="indigo"
          description="Active CampusConnect subjects"
        />
        <StatCard
          label="Students Reached"
          value={totalStudents}
          icon={Users}
          tone="emerald"
          description="Across all your subjects"
        />
        <StatCard
          label="Reference Documents"
          value={metrics.documents}
          icon={Sparkles}
          tone="amber"
          description="Shared with the AI assistant"
        />
      </section>

      {error ? <div className="cs-timetable-import__error">{error}</div> : null}

      <div className="cs-dashboard__columns">
        <div className="cs-dashboard__left">
          <Card>
            <SectionHeader
              title="Post an announcement"
              subtitle="Broadcast to every student in a subject without leaving your dashboard"
            />
            {ownedSubjects.length ? (
              <form className="cs-form-grid" onSubmit={handleAnnounce}>
                <Select
                  label="Subject"
                  value={announceSubjectId}
                  onChange={(event) => setAnnounceSubjectId(event.target.value)}
                >
                  {ownedSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </Select>
                <Textarea
                  label="Message"
                  placeholder="e.g. Tomorrow's class is moved to Lab 2, 10 AM."
                  value={announceText}
                  onChange={(event) => setAnnounceText(event.target.value)}
                  rows={4}
                />
                <Button type="submit" disabled={sending || !announceText.trim()}>
                  <Send size={16} /> {sending ? "Posting..." : "Post announcement"}
                </Button>
                {sentNotice ? <p className="cs-field__hint">{sentNotice}</p> : null}
              </form>
            ) : loadingSubjects ? (
              <Loader />
            ) : (
              <EmptyState
                title="No subjects yet"
                description="Create a subject in CampusConnect to start posting announcements."
                actionLabel="Create a subject"
                onAction={() => (window.location.href = "/campus-connect")}
              />
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Your subjects"
              subtitle="Join codes and class sizes at a glance"
              action={
                <Link className="cs-link" to="/campus-connect">
                  Manage all <ArrowRight size={14} />
                </Link>
              }
            />
            {loadingSubjects ? (
              <Loader />
            ) : ownedSubjects.length ? (
              <div className="cs-dashboard__upload-list">
                {ownedSubjects.map((subject) => (
                  <div key={subject.id} className="cs-dashboard__upload-item">
                    <div className="cs-dashboard__upload-icon">
                      <BookOpen size={16} />
                    </div>
                    <div>
                      <strong>{subject.name}</strong>
                      <p>{Math.max(0, (subject.memberCount || 1) - 1)} students{subject.semester ? ` • Sem ${subject.semester}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      className="cs-icon-button"
                      onClick={() => copyJoinCode(subject.joinCode)}
                      aria-label={`Copy join code for ${subject.name}`}
                      title={`Join code: ${subject.joinCode}`}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No subjects yet" description="Subjects you create will appear here." />
            )}
          </Card>
        </div>

        <div className="cs-dashboard__right">
          <Card>
            <SectionHeader
              title="Find a student"
              subtitle="Look up register number, department, or email"
            />
            <form className="cs-search cs-teacher-search" onSubmit={handleStudentSearch}>
              <Search size={16} />
              <input
                type="search"
                placeholder="Search by name, register no., or email"
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                aria-label="Search students"
              />
            </form>
            {searching ? (
              <Loader />
            ) : studentResults.length ? (
              <div className="cs-dashboard__chat-list">
                {studentResults.map((student) => (
                  <article key={student.id} className="cs-dashboard__chat-item">
                    <Users size={16} />
                    <div>
                      <strong>{student.name}</strong>
                      <p>{[student.registerNumber, student.department, student.semester ? `Sem ${student.semester}` : ""].filter(Boolean).join(" • ")}</p>
                      <p>{student.email}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : studentQuery.trim().length >= 2 ? (
              <EmptyState title="No matches" description="Try a different name, register number, or email." />
            ) : null}
          </Card>

          <Card>
            <SectionHeader
              title="Quick access"
              subtitle="Tools that save you time"
            />
            <div className="cs-dashboard__quick-grid">
              <QuickAccessCard
                title="CampusConnect"
                description="Manage subjects & messages"
                icon={Megaphone}
                to="/campus-connect"
              />
              <QuickAccessCard
                title="AI Assistant"
                description="Draft notes or explanations"
                icon={Sparkles}
                to="/chat"
              />
              <QuickAccessCard
                title="Documents"
                description="Share reference material"
                icon={BookOpen}
                to="/library"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
