import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, FileImage, Pencil, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import EmptyState from "../components/common/EmptyState";
import Modal from "../components/common/Modal";
import SectionHeader from "../components/common/SectionHeader";
import ClassEditorForm from "../components/timetable/ClassEditorForm";
import { useApp } from "../context/AppContext";
import { getApiError } from "../services/api";
import { previewTimetableFile } from "../services/timetableService";
import { sortTimetable } from "../services/timetableService";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const blankClass = { day: "Mon", startTime: "09:00", endTime: "10:00", subject: "", room: "", faculty: "", type: "Theory" };
const importBlank = { entries: [], fileName: "", replaceExisting: true };

// Pixel scale the timetable grid is drawn at: each hour row in the time
// column is this many px tall, so every class block is positioned and sized
// from its actual start/end time using the same scale. This keeps a class
// visually aligned with its real time slot instead of just being stacked in
// the order it was added. 92px/hour (vs. a plain 52px) leaves enough room
// for a wrapped subject name, the time/room/faculty line, and the edit &
// delete buttons to all stay fully visible instead of being clipped.
const PX_PER_HOUR = 92;
const PX_PER_MINUTE = PX_PER_HOUR / 60;
const GRID_START_MINUTES = timeToMinutesValue(timeSlots[0]);
const GRID_END_MINUTES = timeToMinutesValue(timeSlots[timeSlots.length - 1]) + 60;

function timeToMinutesValue(value) {
  const [h, m] = String(value || "").split(":").map(Number);
  return (h * 60) + (m || 0);
}
const timeToMinutes = timeToMinutesValue;

function classPosition(entry) {
  const start = clamp(timeToMinutes(entry.startTime), GRID_START_MINUTES, GRID_END_MINUTES);
  const end = clamp(timeToMinutes(entry.endTime), GRID_START_MINUTES, GRID_END_MINUTES);
  const top = (start - GRID_START_MINUTES) * PX_PER_MINUTE;
  const height = Math.max(46, (end - start) * PX_PER_MINUTE);
  return { top: `${top}px`, height: `${height}px` };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function classStyle(entry) {
  return `cs-timetable__class cs-timetable__class--${String(entry.type || "Theory").toLowerCase()}`;
}

export default function Timetable() {
  const { timetable, profile, addTimetableClass, updateTimetableClass, deleteTimetableClass, importTimetable } = useApp();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formValue, setFormValue] = useState(blankClass);
  const [importState, setImportState] = useState(importBlank);
  const [isReading, setIsReading] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  const sortedTimetable = useMemo(() => sortTimetable(timetable), [timetable]);
  const currentSemester = profile?.semester ? `Semester ${profile.semester}` : "your current semester";
  const subjectNames = Array.isArray(profile?.subjects) ? profile.subjects : [];

  function handleDeleteClass(entry) {
    // Students can delete a class at any time, including one that has
    // already started today - a quick confirm just guards against a
    // misclick since this can't be undone.
    const confirmed = window.confirm(`Delete ${entry.subject} (${entry.day} ${entry.startTime}-${entry.endTime})? This can't be undone.`);
    if (confirmed) deleteTimetableClass(entry.id);
  }

  function openEditor(entry = null) {
    setEditingEntry(entry);
    setFormValue(entry ? { ...entry } : { ...blankClass, subject: subjectNames[0] || "" });
    setIsEditorOpen(true);
  }

  function submitClass(event) {
    event.preventDefault();
    if (editingEntry) updateTimetableClass(editingEntry.id, formValue);
    else addTimetableClass(formValue);
    setIsEditorOpen(false);
    setEditingEntry(null);
    setFormValue(blankClass);
  }

  function openImport() {
    setImportState(importBlank);
    setImportError("");
    setIsImportOpen(true);
  }

  function chooseFile() {
    fileInputRef.current?.click();
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsReading(true);
    setImportError("");
    try {
      const allowed = ["application/pdf"];
      if (!file.type.startsWith("image/") && !allowed.includes(file.type)) {
        throw new Error("Please choose a timetable image in any browser-supported image format, or a PDF.");
      }
      const result = await previewTimetableFile(file);
      setImportState({ entries: result.entries || [], fileName: result.fileName || file.name, replaceExisting: true });
    } catch (error) {
      setImportError(getApiError(error));
    } finally {
      setIsReading(false);
    }
  }

  function updateImportedEntry(index, field, value) {
    setImportState((current) => ({
      ...current,
      entries: current.entries.map((entry, i) => i === index ? { ...entry, [field]: value } : entry),
    }));
  }

  function removeImportedEntry(index) {
    setImportState((current) => ({ ...current, entries: current.entries.filter((_, i) => i !== index) }));
  }

  async function confirmImport() {
    if (!importState.entries.length) return;
    setIsSavingImport(true);
    setImportError("");
    try {
      await importTimetable(importState.entries, importState.replaceExisting);
      setIsImportOpen(false);
      setImportState(importBlank);
    } catch (error) {
      setImportError(getApiError(error));
    } finally {
      setIsSavingImport(false);
    }
  }

  return (
    <div className="cs-page-stack">
      <input ref={fileInputRef} type="file" hidden accept="image/*,.pdf,application/pdf" onChange={handleFile} />

      <SectionHeader
        title="Timetable"
        subtitle={`Your weekly academic schedule · ${currentSemester}`}
        action={
          <div className="cs-timetable__toolbar">
            <Button variant="secondary" onClick={openImport}>
              <UploadCloud size={16} /> Import timetable
            </Button>
            <Button onClick={() => openEditor()}>
              <CalendarPlus size={16} /> Add class
            </Button>
          </div>
        }
      />

      <Card className="cs-timetable__import-tip">
        <div className="cs-timetable__import-tip-icon"><FileImage size={20} /></div>
        <div>
          <strong>Save time with timetable import</strong>
          <p>Upload a clear timetable photo, screenshot, or PDF. CampusSage will detect classes automatically and let you verify them before saving.</p>
        </div>
        <Button variant="ghost" onClick={openImport}>Upload now</Button>
      </Card>

      <Card className="cs-timetable__board">
        <div className="cs-timetable__header-row">
          <div className="cs-timetable__corner">Time</div>
          {weekDays.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="cs-timetable__grid">
          <div className="cs-timetable__time-column">
            {timeSlots.map((time) => <div key={time}>{time}</div>)}
          </div>
          {weekDays.map((day) => (
            <div key={day} className="cs-timetable__day-column">
              {sortedTimetable.filter((entry) => entry.day === day).map((entry) => (
                <div key={entry.id} className={classStyle(entry)} style={classPosition(entry)} title={entry.subject}>
                  <div className="cs-timetable__class-actions">
                    <button onClick={() => openEditor(entry)} aria-label={`Edit ${entry.subject}`} title="Edit class"><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteClass(entry)} aria-label={`Delete ${entry.subject}`} title="Delete class"><Trash2 size={13} /></button>
                  </div>
                  <div className="cs-timetable__class-body">
                    <strong>{entry.subject}</strong>
                    <span>{entry.startTime} - {entry.endTime}</span>
                    {entry.room ? <span>{entry.room}</span> : null}
                    {entry.faculty ? <span>{entry.faculty}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {!sortedTimetable.length ? (
        <EmptyState title="No classes yet" description="Import your timetable from a photo or PDF, or add classes manually." actionLabel="Import timetable" onAction={openImport} />
      ) : null}

      <Modal open={isEditorOpen} title={editingEntry ? "Edit class" : "Add class"} onClose={() => setIsEditorOpen(false)}>
        <ClassEditorForm value={formValue} onChange={setFormValue} onSubmit={submitClass} onCancel={() => setIsEditorOpen(false)} />
      </Modal>

      <Modal open={isImportOpen} title="Import timetable" width="large" onClose={() => !isReading && !isSavingImport && setIsImportOpen(false)}>
        <div className="cs-timetable-import">
          {!importState.entries.length ? (
            <div className="cs-timetable-import__upload">
              <div className="cs-timetable-import__icon"><UploadCloud size={30} /></div>
              <h3>{isReading ? "Reading your timetable..." : "Upload your timetable"}</h3>
              <p>{isReading ? "Gemini is detecting days, times, subjects, rooms and faculty. This may take a few seconds." : "Use a clear photo, screenshot, or PDF. For best results, make sure the full timetable is visible."}</p>
              <Button onClick={chooseFile} disabled={isReading}>{isReading ? <><RefreshCw className="cs-spin" size={16} /> Processing...</> : <><UploadCloud size={16} /> Choose timetable</>}</Button>
              <span className="cs-timetable-import__hint">Any image format supported by your browser or PDF · max 10 MB</span>
            </div>
          ) : (
            <>
              <div className="cs-timetable-import__success">
                <Check size={18} /> {importState.entries.length} classes detected from <strong>{importState.fileName}</strong>
              </div>

              <div className="cs-timetable-import__review-head">
                <div>
                  <h3>Review detected classes</h3>
                  <p>Correct anything that looks wrong before adding it to your timetable.</p>
                </div>
                <Button variant="ghost" onClick={chooseFile} disabled={isSavingImport}>Choose another file</Button>
              </div>

              <div className="cs-timetable-import__table-wrap">
                <table className="cs-timetable-import__table">
                  <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Subject</th><th>Room</th><th>Faculty</th><th>Type</th><th></th></tr></thead>
                  <tbody>
                    {importState.entries.map((entry, index) => (
                      <tr key={`${entry.day}-${entry.startTime}-${index}`}>
                        <td><select value={entry.day} onChange={(e) => updateImportedEntry(index, "day", e.target.value)}>{weekDays.map((day) => <option key={day}>{day}</option>)}</select></td>
                        <td><input type="time" value={entry.startTime} onChange={(e) => updateImportedEntry(index, "startTime", e.target.value)} /></td>
                        <td><input type="time" value={entry.endTime} onChange={(e) => updateImportedEntry(index, "endTime", e.target.value)} /></td>
                        <td><input value={entry.subject} onChange={(e) => updateImportedEntry(index, "subject", e.target.value)} /></td>
                        <td><input value={entry.room} onChange={(e) => updateImportedEntry(index, "room", e.target.value)} /></td>
                        <td><input value={entry.faculty} onChange={(e) => updateImportedEntry(index, "faculty", e.target.value)} /></td>
                        <td><select value={entry.type} onChange={(e) => updateImportedEntry(index, "type", e.target.value)}><option>Theory</option><option>Lab</option><option>Tutorial</option></select></td>
                        <td><button className="cs-timetable-import__remove" onClick={() => removeImportedEntry(index)} aria-label="Remove class"><X size={15} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="cs-timetable-import__replace">
                <input type="checkbox" checked={importState.replaceExisting} onChange={(e) => setImportState((current) => ({ ...current, replaceExisting: e.target.checked }))} />
                <span><strong>Replace my current timetable</strong><small>Recommended when this image is your complete weekly timetable. Turn this off to add these classes to existing entries.</small></span>
              </label>

              {importError ? <div className="cs-timetable-import__error">{importError}</div> : null}

              <div className="cs-form-grid__actions">
                <Button onClick={confirmImport} disabled={isSavingImport || !importState.entries.length}>{isSavingImport ? <><RefreshCw className="cs-spin" size={16} /> Saving...</> : <><Check size={16} /> Confirm & save</>}</Button>
                <Button type="button" variant="ghost" onClick={() => setIsImportOpen(false)} disabled={isSavingImport}>Cancel</Button>
              </div>
            </>
          )}
          {importError && !importState.entries.length ? <div className="cs-timetable-import__error">{importError}</div> : null}
        </div>
      </Modal>
    </div>
  );
}
