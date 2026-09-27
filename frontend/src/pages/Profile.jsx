import { useEffect, useState } from "react";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import { Input, Select } from "../components/common/Input";
import SectionHeader from "../components/common/SectionHeader";
import { useApp } from "../context/AppContext";

export default function Profile() {
  const { profile, updateProfile } = useApp();

  const [form, setForm] = useState({
    name: profile?.name || "",
    registerNumber: profile?.registerNumber || "",
    department: profile?.department || "",
    semester: profile?.semester || "",
    collegeName: profile?.collegeName || "",
    preferredLanguage: profile?.preferredLanguage || "English",
    subjects: Array.isArray(profile?.subjects) ? profile.subjects : [],
  });

  const [subjectInput, setSubjectInput] = useState("");

  useEffect(() => {
    setForm({
      name: profile?.name || "",
      registerNumber: profile?.registerNumber || "",
      department: profile?.department || "",
      semester: profile?.semester || "",
      collegeName: profile?.collegeName || "",
      preferredLanguage: profile?.preferredLanguage || "English",
      subjects: Array.isArray(profile?.subjects) ? profile.subjects : [],
    });
  }, [profile]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addSubject() {
    const subject = subjectInput.trim();

    if (!subject) return;

    const alreadyExists = form.subjects.some(
      (item) => item.toLowerCase() === subject.toLowerCase(),
    );

    if (alreadyExists) {
      setSubjectInput("");
      return;
    }

    setForm((current) => ({
      ...current,
      subjects: [...current.subjects, subject],
    }));

    setSubjectInput("");
  }

  function removeSubject(subjectToRemove) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.filter(
        (subject) => subject !== subjectToRemove,
      ),
    }));
  }

  function handleSubjectKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubject();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    updateProfile({
      ...form,
      name: form.name.trim(),
      registerNumber: form.registerNumber.trim(),
      department: form.department.trim(),
      semester: String(form.semester).trim(),
      collegeName: form.collegeName.trim(),
      subjects: form.subjects.map((subject) => subject.trim()).filter(Boolean),
    });
  }

  const initials =
    form.name
      ?.trim()
      ?.split(/\s+/)
      ?.map((part) => part[0])
      ?.join("")
      ?.slice(0, 2)
      ?.toUpperCase() || "S";

  return (
    <div className="cs-page-stack cs-profile-page">
      <SectionHeader
        title="Profile"
        subtitle="Your academic identity, preferences, and CampusSage workspace"
      />

      {/* Student identity */}
      <Card className="cs-profile-hero">
        <div className="cs-profile-hero__identity">
          <div className="cs-profile-hero__avatar">{initials}</div>

          <div className="cs-profile-hero__details">
            <div className="cs-profile-hero__eyebrow">STUDENT PROFILE</div>

            <h2>{form.name || "Student Name"}</h2>

            <div className="cs-profile-hero__meta">
              <span>🎓 {form.department || "Department not set"}</span>

              <span className="cs-profile-hero__separator">•</span>

              <span>Semester {form.semester || "—"}</span>
            </div>

            <p>{form.collegeName || "College name not set"}</p>
          </div>
        </div>

        <div className="cs-profile-hero__register">
          <span>Register Number</span>
          <strong>{form.registerNumber || "Not set"}</strong>
        </div>
      </Card>

      {/* Academic overview */}
      <div className="cs-profile__stats">
        <div className="cs-profile-stat">
          <div className="cs-profile-stat__icon">🎓</div>
          <div>
            <span>Department</span>
            <strong>{form.department || "Not set"}</strong>
          </div>
        </div>

        <div className="cs-profile-stat">
          <div className="cs-profile-stat__icon">📚</div>
          <div>
            <span>Semester</span>
            <strong>{form.semester || "Not set"}</strong>
          </div>
        </div>

        <div className="cs-profile-stat">
          <div className="cs-profile-stat__icon">📖</div>
          <div>
            <span>Subjects</span>
            <strong>{form.subjects.length}</strong>
          </div>
        </div>

        <div className="cs-profile-stat">
          <div className="cs-profile-stat__icon">🌐</div>
          <div>
            <span>Language</span>
            <strong>{form.preferredLanguage}</strong>
          </div>
        </div>
      </div>

      {/* Main profile form */}
      <form className="cs-profile__layout" onSubmit={handleSubmit}>
        {/* Academic information */}
        <Card className="cs-profile-section">
          <div className="cs-profile-section__header">
            <div className="cs-profile-section__icon">🎓</div>

            <div>
              <h3>Academic Information</h3>
              <p>
                Keep your academic details up to date so CampusSage can
                personalize your workspace.
              </p>
            </div>
          </div>

          <div className="cs-profile-fields">
            <Input
              label="Full name"
              value={form.name}
              placeholder="Enter your full name"
              onChange={(event) => updateField("name", event.target.value)}
            />

            <Input
              label="Register number"
              value={form.registerNumber}
              placeholder="Enter your register number"
              onChange={(event) =>
                updateField("registerNumber", event.target.value)
              }
            />

            <Input
              label="Department"
              value={form.department}
              placeholder="Example: CSE"
              onChange={(event) =>
                updateField("department", event.target.value)
              }
            />

            <Select
              label="Current semester"
              value={String(form.semester)}
              onChange={(event) => updateField("semester", event.target.value)}
            >
              <option value="">Select semester</option>

              {Array.from({ length: 8 }, (_, index) => (
                <option key={index + 1} value={String(index + 1)}>
                  Semester {index + 1}
                </option>
              ))}
            </Select>

            <Input
              label="College name"
              value={form.collegeName}
              placeholder="Enter your college name"
              onChange={(event) =>
                updateField("collegeName", event.target.value)
              }
            />

            <Select
              label="Preferred language"
              value={form.preferredLanguage}
              onChange={(event) =>
                updateField("preferredLanguage", event.target.value)
              }
            >
              <option>English</option>
              <option>Tamil</option>
              <option>Hindi</option>
            </Select>
          </div>
        </Card>

        {/* Subjects */}
        <Card className="cs-profile-section">
          <div className="cs-profile-section__header">
            <div className="cs-profile-section__icon">📚</div>

            <div>
              <h3>My Subjects</h3>
              <p>
                Add the subjects you are currently studying in this semester.
              </p>
            </div>
          </div>

          <div className="cs-profile-subject-input">
            <Input
              label="Add a subject"
              value={subjectInput}
              placeholder="Example: Database Management Systems"
              onChange={(event) => setSubjectInput(event.target.value)}
              onKeyDown={handleSubjectKeyDown}
            />

            <Button
              type="button"
              variant="secondary"
              onClick={addSubject}
              className="cs-profile-add-subject"
            >
              + Add subject
            </Button>
          </div>

          <div className="cs-profile-subjects">
            {form.subjects.length > 0 ? (
              form.subjects.map((subject) => (
                <div className="cs-profile-subject" key={subject}>
                  <span>{subject}</span>

                  <button
                    type="button"
                    className="cs-profile-subject__remove"
                    aria-label={`Remove ${subject}`}
                    onClick={() => removeSubject(subject)}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="cs-profile-subjects__empty">
                <span>📚</span>
                <p>No subjects added yet. Add your current subjects above.</p>
              </div>
            )}
          </div>
        </Card>

        {/* AI preferences */}
        <Card className="cs-profile-section cs-profile-section--preferences">
          <div className="cs-profile-section__header">
            <div className="cs-profile-section__icon">🤖</div>

            <div>
              <h3>CampusSage Preferences</h3>
              <p>
                Your profile information helps CampusSage understand your
                academic context.
              </p>
            </div>
          </div>

          <div className="cs-profile-preference">
            <div>
              <strong>Academic context</strong>
              <p>
                Your semester and subjects can be used to prioritize relevant
                academic information.
              </p>
            </div>

            <span className="cs-profile-status">Active</span>
          </div>

          <div className="cs-profile-preference">
            <div>
              <strong>Preferred response language</strong>
              <p>CampusSage will use your selected language when applicable.</p>
            </div>

            <span className="cs-profile-language">
              {form.preferredLanguage}
            </span>
          </div>
        </Card>

        {/* Save */}
        <div className="cs-profile__actions">
          <Button type="submit">Save profile</Button>
        </div>
      </form>
    </div>
  );
}
