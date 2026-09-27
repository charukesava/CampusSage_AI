import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  BookOpen,
  CalendarDays,
  FileText,
  MessageSquare,
  Sparkles,
  TimerReset,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import SectionHeader from "../components/common/SectionHeader";
import StatCard from "../components/common/StatCard";
import { useApp } from "../context/AppContext";

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

export default function Dashboard() {
  const { profile, metrics, chats, documents, notices, addDocuments } =
    useApp();
  const welcomeNotice = notices[0];

  function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      addDocuments(files);
    }
    event.target.value = "";
  }

  return (
    <div className="cs-page-grid">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="cs-dashboard__hero"
      >
        <div>
          <Badge tone="success">Personal academic workspace</Badge>
          <h2>Welcome back, {profile.name} 👋</h2>
          <p>How can I help you today?</p>
        </div>
        <Button>
          <Sparkles size={16} /> AI Suggestions
        </Button>
      </motion.section>

      <section className="cs-dashboard__stats">
        <StatCard
          label="Documents"
          value={metrics.documents}
          icon={FileText}
          tone="indigo"
          description="Uploaded and indexed"
        />
        <StatCard
          label="Subjects"
          value={metrics.subjects}
          icon={BookOpen}
          tone="amber"
          description="Current semester subjects"
        />
        <StatCard
          label="Today's Classes"
          value={metrics.todayClasses}
          icon={CalendarDays}
          tone="emerald"
          description="Scheduled in timetable"
        />
        <StatCard
          label="Pending Assignments"
          value={metrics.pendingAssignments}
          icon={TimerReset}
          tone="rose"
          description="Requires your attention"
        />
      </section>

      <input
        id="dashboard-upload"
        type="file"
        multiple
        accept=".pdf,.docx,.pptx"
        className="cs-hidden-input"
        onChange={handleUpload}
      />

      <div className="cs-dashboard__columns">
        <div className="cs-dashboard__left">
          <Card>
            <SectionHeader
              title="Quick Access"
              subtitle="Jump to the most used tools"
            />
            <div className="cs-dashboard__quick-grid">
              <QuickAccessCard
                title="AI Assistant"
                description="Ask academic questions"
                icon={Bot}
                to="/chat"
              />
              <QuickAccessCard
                title="Study Planner"
                description="Build a revision schedule"
                icon={Zap}
                to="/planner"
              />
              <QuickAccessCard
                title="Timetable"
                description="Review today’s classes"
                icon={CalendarDays}
                to="/timetable"
              />
              <QuickAccessCard
                title="Documents"
                description="Manage uploaded files"
                icon={BookOpen}
                to="/library"
              />
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Recent Chats"
              subtitle="Latest saved conversations"
              action={
                <Link className="cs-link" to="/chat">
                  View all <ArrowRight size={14} />
                </Link>
              }
            />
            {chats.length ? (
              <div className="cs-dashboard__chat-list">
                {chats.slice(0, 3).map((chat) => (
                  <article key={chat.id} className="cs-dashboard__chat-item">
                    <MessageSquare size={16} />
                    <div>
                      <strong>{chat.title}</strong>
                      <p>
                        {chat.messages[chat.messages.length - 1]?.content.slice(
                          0,
                          90,
                        )}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No chats yet"
                description="Start a conversation with your academic documents or timetable."
                actionLabel="Open AI Assistant"
                onAction={() => (window.location.href = "/chat")}
              />
            )}
          </Card>
        </div>

        <div className="cs-dashboard__right">
          <Card className="cs-dashboard__notice-card">
            <SectionHeader
              title="Important Notice"
              subtitle="Auto-generated from your own study data"
            />
            {welcomeNotice ? (
              <div className="cs-dashboard__notice-highlight">
                <Badge tone={welcomeNotice.read ? "success" : "warning"}>
                  {welcomeNotice.type}
                </Badge>
                <h3>{welcomeNotice.title}</h3>
                <p>{welcomeNotice.detail}</p>
                <Button variant="ghost">
                  View details <ArrowRight size={14} />
                </Button>
              </div>
            ) : (
              <EmptyState
                title="No notices yet"
                description="Reminders will appear after you add timetable or deadline data."
              />
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Recent Uploads"
              subtitle="Newest documents in your library"
              action={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      document.getElementById("dashboard-upload").click()
                    }
                  >
                    Upload
                  </Button>
                  <Link className="cs-link" to="/library">
                    View library <ArrowRight size={14} />
                  </Link>
                </div>
              }
            />
            {documents.length ? (
              <div className="cs-dashboard__upload-list">
                {documents.slice(0, 4).map((document) => (
                  <div key={document.id} className="cs-dashboard__upload-item">
                    <div className="cs-dashboard__upload-icon">
                      <FileText size={16} />
                    </div>
                    <div>
                      <strong>{document.name}</strong>
                      <p>
                        {document.type} • {document.size}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No uploads yet"
                description="Upload PDFs, PPTs, or documents to build your personal knowledge base."
              />
            )}
          </Card>

          <Card>
            <SectionHeader
              title="AI Suggestions"
              subtitle="What CampusSage can help with"
            />
            <div className="cs-dashboard__suggestions">
              <div>
                <Sparkles size={16} /> Summarize DBMS Unit 2 from your notes.
              </div>
              <div>
                <Sparkles size={16} /> Create flashcards for Computer Networks.
              </div>
              <div>
                <Sparkles size={16} /> Plan study time before the next exam.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
