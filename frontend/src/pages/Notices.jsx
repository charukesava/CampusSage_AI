import { useMemo, useState } from "react";
import { Filter, RefreshCcw, Trash2, CheckCircle2 } from "lucide-react";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import SectionHeader from "../components/common/SectionHeader";
import { useApp } from "../context/AppContext";

const filters = [
  "All",
  "Unread",
  "Read",
  "Assignment",
  "Class",
  "Lab",
  "Exam",
  "Study",
];

export default function Notices() {
  const { notices, markNoticeRead, deleteNotice, regenerateNotices } = useApp();
  const [filter, setFilter] = useState("All");

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      if (filter === "All") {
        return true;
      }
      if (filter === "Unread") {
        return !notice.read;
      }
      if (filter === "Read") {
        return notice.read;
      }
      return notice.type === filter;
    });
  }, [notices, filter]);

  return (
    <div className="cs-page-stack">
      <SectionHeader
        title="Notices"
        subtitle="Personal reminders from timetable, deadlines, and exams"
        action={
          <Button variant="secondary" onClick={regenerateNotices}>
            <RefreshCcw size={16} /> Refresh reminders
          </Button>
        }
      />

      <div className="cs-filter-bar">
        {filters.map((item) => (
          <button
            key={item}
            className={`cs-filter-chip ${filter === item ? "is-active" : ""}`}
            onClick={() => setFilter(item)}
          >
            <Filter size={14} /> {item}
          </button>
        ))}
      </div>

      {filteredNotices.length ? (
        <div className="cs-notices__list">
          {filteredNotices.map((notice) => (
            <Card
              key={notice.id}
              className={`cs-notice-card ${notice.read ? "is-read" : ""}`}
            >
              <div className="cs-notice-card__header">
                <Badge
                  tone={
                    notice.type === "Assignment"
                      ? "warning"
                      : notice.type === "Exam"
                        ? "danger"
                        : "info"
                  }
                >
                  {notice.type}
                </Badge>
                <span>{new Date(notice.createdAt).toLocaleString()}</span>
              </div>
              <h3>{notice.title}</h3>
              <p>{notice.detail}</p>
              <div className="cs-notice-card__footer">
                <Button
                  variant="ghost"
                  onClick={() => markNoticeRead(notice.id)}
                >
                  <CheckCircle2 size={14} /> Mark read
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteNotice(notice.id)}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notices yet"
          description="Reminders will appear after you add timetable, assignment, or exam data."
        />
      )}
    </div>
  );
}
