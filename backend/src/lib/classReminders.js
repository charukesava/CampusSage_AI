import { sendMail, isMailerConfigured } from "./mailer.js";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesNow(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function toMinutes(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/**
 * Every minute, looks for timetable classes starting within the next
 * REMINDER_MINUTES_BEFORE minutes (default 10) for the current day, and emails
 * a reminder to the student's login email address - once per class per day.
 * This only reads existing tables and never changes any API endpoint.
 */
export function startClassReminderScheduler(pool) {
  const reminderWindow = Number(process.env.CLASS_REMINDER_MINUTES_BEFORE || 10);

  async function tick() {
    try {
      const now = new Date();
      const today = DAY_ABBR[now.getDay()];
      const nowMinutes = minutesNow(now);
      const todayDate = now.toISOString().slice(0, 10);

      const { rows } = await pool.query(
        `SELECT t.id AS timetable_id, t.user_id, t.subject, t.room, t.faculty, t.start_time,
                u.email, p.name
         FROM timetable t
         JOIN users u ON u.id = t.user_id
         JOIN profiles p ON p.user_id = t.user_id
         JOIN settings s ON s.user_id = t.user_id
         WHERE t.day = $1 AND s.email_notifications = TRUE AND s.notifications = TRUE`,
        [today]
      );

      for (const row of rows) {
        const startMinutes = toMinutes(row.start_time);
        const minutesUntil = startMinutes - nowMinutes;
        if (minutesUntil < 0 || minutesUntil > reminderWindow) continue;

        const already = await pool.query(
          "SELECT 1 FROM class_reminder_log WHERE user_id=$1 AND timetable_id=$2 AND reminder_date=$3",
          [row.user_id, row.timetable_id, todayDate]
        );
        if (already.rowCount) continue;

        // Record first so a slow/failed email send can't cause duplicate sends
        // on the next tick.
        await pool.query(
          "INSERT INTO class_reminder_log(user_id, timetable_id, reminder_date) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [row.user_id, row.timetable_id, todayDate]
        );

        if (!isMailerConfigured()) continue;
        const startLabel = formatTime(row.start_time);
        await sendMail({
          to: row.email,
          subject: `Reminder: ${row.subject} starts at ${startLabel}`,
          text: `Hi ${row.name || "there"},\n\nYour ${row.subject} class starts at ${startLabel}${row.room ? ` in ${row.room}` : ""}${row.faculty ? ` with ${row.faculty}` : ""}.\n\n- CampusSage AI`,
          html: `<p>Hi ${row.name || "there"},</p><p>Your <strong>${row.subject}</strong> class starts at <strong>${startLabel}</strong>${row.room ? ` in <strong>${row.room}</strong>` : ""}${row.faculty ? ` with ${row.faculty}` : ""}.</p><p>- CampusSage AI</p>`,
        }).catch((error) => console.error("Failed to send class reminder email:", error.message));
      }
    } catch (error) {
      console.error("Class reminder scheduler error:", error.message);
    }
  }

  tick();
  return setInterval(tick, 60 * 1000);
}
