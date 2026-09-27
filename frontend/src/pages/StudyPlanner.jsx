import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { Input, Select } from "../components/common/Input";
import SectionHeader from "../components/common/SectionHeader";
import StatCard from "../components/common/StatCard";
import { useApp } from "../context/AppContext";

export default function StudyPlanner() {
  const { planner, updatePlanner, markTaskDone } = useApp();
  const [form, setForm] = useState({
    examDate: planner.examDate,
    availableHours: planner.availableHours,
    priority: planner.priority,
    subjectOne: planner.subjects[0]?.name || "",
    subjectTwo: planner.subjects[1]?.name || "",
    subjectThree: planner.subjects[2]?.name || "",
  });

  const completed = planner.tasks.filter((task) => task.done).length;
  const progress = planner.tasks.length
    ? Math.round((completed / planner.tasks.length) * 100)
    : 0;

  const daysLeft = useMemo(() => {
    if (!planner.examDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(`${planner.examDate}T00:00:00`);
    return Math.ceil((exam - today) / 86400000);
  }, [planner.examDate]);

  const groupedTasks = useMemo(() => {
    const groups = new Map();
    planner.tasks.forEach((task) => {
      if (!groups.has(task.date)) groups.set(task.date, []);
      groups.get(task.date).push(task);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planner.tasks]);

  function formatGroupDate(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
  }

  function generatePlan(event) {
    event.preventDefault();
    updatePlanner({
      examDate: form.examDate,
      availableHours: Number(form.availableHours),
      priority: form.priority,
      subjects: [
        { name: form.subjectOne, weight: 3 },
        { name: form.subjectTwo, weight: 2 },
        { name: form.subjectThree, weight: 1 },
      ].filter((subject) => subject.name.trim()),
    });
  }

  return (
    <div className="cs-page-stack">
      <SectionHeader
        title="Study Planner"
        subtitle="Create a practical revision schedule"
      />
      <div className="cs-planner__summary">
        <StatCard
          label="Progress"
          value={`${progress}%`}
          icon={BarChart3}
          tone="indigo"
          description={`${completed} of ${planner.tasks.length} tasks completed`}
        />
        <StatCard
          label="Days Left"
          value={daysLeft != null ? Math.max(0, daysLeft) : "-"}
          icon={CalendarDays}
          tone="amber"
          description={planner.examDate ? `Exam on ${planner.examDate}` : "Set an exam date"}
        />
        <StatCard
          label="Daily Focus"
          value={`${planner.availableHours}h`}
          icon={CheckCircle2}
          tone="emerald"
          description="Available study time"
        />
      </div>

      <div className="cs-planner__grid">
        <Card>
          <SectionHeader
            title="Plan inputs"
            subtitle="Use your own exam date and available hours"
          />
          <form className="cs-form-grid" onSubmit={generatePlan}>
            <Input
              label="Exam date"
              type="date"
              value={form.examDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  examDate: event.target.value,
                }))
              }
            />
            <Input
              label="Available study hours"
              type="number"
              min="1"
              max="12"
              value={form.availableHours}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  availableHours: event.target.value,
                }))
              }
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </Select>
            <Input
              label="Subject 1"
              value={form.subjectOne}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subjectOne: event.target.value,
                }))
              }
            />
            <Input
              label="Subject 2"
              value={form.subjectTwo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subjectTwo: event.target.value,
                }))
              }
            />
            <Input
              label="Subject 3"
              value={form.subjectThree}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  subjectThree: event.target.value,
                }))
              }
            />
            <Button type="submit">Generate study schedule</Button>
          </form>
        </Card>

        <Card>
          <SectionHeader
            title="Daily tasks"
            subtitle="Generated revision plan"
          />
          <div className="cs-planner__progress">
            <div
              className="cs-planner__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="cs-planner__task-list">
            {groupedTasks.length ? (
              groupedTasks.map(([date, tasks]) => {
                const dayDone = tasks.filter((t) => t.done).length;
                return (
                  <div key={date} className="cs-planner__day-group">
                    <div className="cs-planner__day-heading">
                      <span><Clock size={13} /> {formatGroupDate(date)}</span>
                      <span>{dayDone}/{tasks.length} done</span>
                    </div>
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        className={`cs-planner__task ${task.done ? "is-done" : ""}`}
                        onClick={() => markTaskDone(task.id)}
                      >
                        <strong>{task.subject}</strong>
                        <p>{task.label}</p>
                      </button>
                    ))}
                  </div>
                );
              })
            ) : (
              <p className="cs-field__hint">Fill in the plan inputs to generate a session-by-session revision schedule.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
