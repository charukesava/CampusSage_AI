import { useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";

// How many minutes before a class starts the pop-up/browser notification fires.
const REMINDER_WINDOW_MINUTES = 10;
// How long a toast stays on screen before auto-dismissing.
const TOAST_LIFETIME_MS = 20000;
const CHECK_INTERVAL_MS = 20000;
const STORAGE_KEY = "campussage-notified-classes";

function toMinutes(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function loadNotifiedToday() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : { date: "", ids: [] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return { date: today, ids: [] };
    return parsed;
  } catch {
    return { date: new Date().toISOString().slice(0, 10), ids: [] };
  }
}

function saveNotifiedToday(state) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export default function ClassReminderToast() {
  const { user } = useAuth();
  const { timetable, settings } = useApp();
  const [toasts, setToasts] = useState([]);
  const notifiedRef = useRef(loadNotifiedToday());
  const permissionRequestedRef = useRef(false);

  const notificationsEnabled = settings?.notifications !== false && user?.role !== "teacher";

  useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (permissionRequestedRef.current) return;
    if (Notification.permission === "default") {
      permissionRequestedRef.current = true;
      Notification.requestPermission().catch(() => {});
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (!notificationsEnabled || !timetable?.length) return;

    function checkUpcomingClasses() {
      const now = new Date();
      const today = new Date().toISOString().slice(0, 10);
      if (notifiedRef.current.date !== today) notifiedRef.current = { date: today, ids: [] };

      const dayAbbr = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(now).slice(0, 3);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      timetable
        .filter((entry) => entry.day === dayAbbr)
        .forEach((entry) => {
          const minutesUntil = toMinutes(entry.startTime) - nowMinutes;
          const alreadyNotified = notifiedRef.current.ids.includes(entry.id);
          if (alreadyNotified || minutesUntil < 0 || minutesUntil > REMINDER_WINDOW_MINUTES) return;

          notifiedRef.current = { ...notifiedRef.current, ids: [...notifiedRef.current.ids, entry.id] };
          saveNotifiedToday(notifiedRef.current);

          const title = minutesUntil <= 1
            ? `${entry.subject} is starting now`
            : `${entry.subject} starts in ${minutesUntil} min`;
          const body = `${formatTime(entry.startTime)}${entry.room ? ` · ${entry.room}` : ""}${entry.faculty ? ` · ${entry.faculty}` : ""}`;

          setToasts((current) => [...current, { id: `${entry.id}-${today}`, title, body }]);

          if ("Notification" in window && Notification.permission === "granted") {
            try { new Notification(title, { body, tag: `class-${entry.id}-${today}` }); } catch { /* ignore */ }
          }
        });
    }

    checkUpcomingClasses();
    const timer = window.setInterval(checkUpcomingClasses, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [notificationsEnabled, timetable]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== toast.id));
      }, TOAST_LIFETIME_MS)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);

  function dismiss(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  if (!toasts.length) return null;

  return (
    <div className="cs-toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="cs-toast">
          <div className="cs-toast__icon"><BellRing size={16} /></div>
          <div className="cs-toast__body">
            <strong>{toast.title}</strong>
            <p>{toast.body}</p>
          </div>
          <button className="cs-toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss reminder">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
