import { apiClient } from "./api";
export async function getPlanner() { return (await apiClient.get("/planner")).data; }
export async function savePlanner(planner) { return (await apiClient.put("/planner", planner)).data; }
export async function togglePlannerTask(id, done) { return (await apiClient.patch(`/planner/tasks/${id}`, { done })).data; }

// Builds a day-by-day revision schedule that actually reflects how much time
// a student has each day (availableHours) instead of a single task per day,
// and gets progressively more revision/practice-focused as the exam gets
// closer so the plan is genuinely useful during exam week.
export function generateStudyPlan({ subjects = [], examDate, availableHours = 2, priority = "Medium" }) {
  if (!examDate || !subjects.length) return [];

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const exam = new Date(`${examDate}T00:00:00`);
  const totalDays = Math.max(1, Math.ceil((exam - start) / 86400000));

  const hours = Math.max(1, Number(availableHours) || 1);
  // Roughly how long one focused session runs, tuned by priority: "High"
  // priority means shorter, more frequent sessions; "Low" means longer,
  // fewer sessions.
  const sessionLengthHours = priority === "High" ? 1 : priority === "Low" ? 2 : 1.5;
  const sessionsPerDay = Math.max(1, Math.min(subjects.length + 1, Math.round(hours / sessionLengthHours)));

  // Higher-weight subjects show up more often in the rotation, so the most
  // important subjects naturally get more sessions across the plan.
  const rotation = [];
  [...subjects]
    .sort((a, b) => (b.weight || 1) - (a.weight || 1))
    .forEach((subject) => {
      const copies = Math.max(1, Math.round(subject.weight || 1));
      for (let i = 0; i < copies; i += 1) rotation.push(subject);
    });

  const tasks = [];
  let cursor = 0;
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + dayOffset);
    const daysUntilExam = totalDays - dayOffset;

    // Final two days: everything shifts to fast revision + practice tests,
    // regardless of the priority setting, since that's what helps most right
    // before an exam.
    const isFinalStretch = daysUntilExam <= 2;
    const isEarlyPhase = dayOffset < totalDays * 0.5;
    const stage = isFinalStretch
      ? "Quick revision + practice questions"
      : isEarlyPhase
        ? "Learn topics & make notes"
        : "Revise notes & solve problems";

    for (let session = 0; session < sessionsPerDay; session += 1) {
      const subject = rotation[cursor % rotation.length];
      cursor += 1;
      tasks.push({
        id: crypto.randomUUID(),
        date: date.toISOString().slice(0, 10),
        subject: subject.name,
        label: `${stage} - ${subject.name} (Session ${session + 1} of ${sessionsPerDay})`,
        done: false,
      });
    }
  }
  return tasks;
}
