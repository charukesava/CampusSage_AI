import { useEffect, useRef } from "react";
import { CalendarClock, MapPin, User, X } from "lucide-react";
import { useApp } from "../../context/AppContext";

function toMinutes(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function classState(entry, nowMinutes) {
  const start = toMinutes(entry.startTime);
  const end = toMinutes(entry.endTime);
  if (nowMinutes >= start && nowMinutes < end) return "now";
  if (start - nowMinutes > 0 && start - nowMinutes <= 10) return "soon";
  if (end <= nowMinutes) return "done";
  return "upcoming";
}

const stateLabel = { now: "Happening now", soon: "Starting soon", done: "Finished", upcoming: "Scheduled" };

export default function NotificationPanel({ open, onClose, anchorRef }) {
  const { timetable } = useApp();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event) {
      if (panelRef.current?.contains(event.target)) return;
      if (anchorRef?.current?.contains(event.target)) return;
      onClose();
    }
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(now).slice(0, 3);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todaysClasses = timetable
    .filter((entry) => entry.day === today)
    .slice()
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(now);

  return (
    <div className="cs-notif-panel" ref={panelRef} role="dialog" aria-label="Scheduled classes">
      <div className="cs-notif-panel__header">
        <div>
          <strong>Today's classes</strong>
          <p>{dateLabel}</p>
        </div>
        <button className="cs-icon-button" onClick={onClose} aria-label="Close notifications">
          <X size={15} />
        </button>
      </div>

      <div className="cs-notif-panel__list">
        {todaysClasses.length ? (
          todaysClasses.map((entry) => {
            const state = classState(entry, nowMinutes);
            return (
              <div key={entry.id} className={`cs-notif-panel__item cs-notif-panel__item--${state}`}>
                <div className="cs-notif-panel__time">
                  <CalendarClock size={14} />
                  <span>{formatTime(entry.startTime)} - {formatTime(entry.endTime)}</span>
                </div>
                <strong>{entry.subject}</strong>
                <div className="cs-notif-panel__meta">
                  {entry.room ? <span><MapPin size={12} /> {entry.room}</span> : null}
                  {entry.faculty ? <span><User size={12} /> {entry.faculty}</span> : null}
                </div>
                <span className={`cs-notif-panel__badge cs-notif-panel__badge--${state}`}>{stateLabel[state]}</span>
              </div>
            );
          })
        ) : (
          <div className="cs-notif-panel__empty">No classes scheduled for today.</div>
        )}
      </div>
    </div>
  );
}
