import { useState } from "react";
import { Brain, CheckCircle2, Eye, EyeOff, FileText, Lock, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import SectionHeader from "../components/common/SectionHeader";
import Toggle from "../components/common/Toggle";
import { Select } from "../components/common/Input";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../services/settingsService";
import { getApiError } from "../services/api";

function SettingRow({ icon: Icon, title, description, children }) {
  return (
    <div className="cs-settings__row">
      <div className="cs-settings__row-icon"><Icon size={18} /></div>
      <div className="cs-settings__row-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="cs-settings__row-control">{children}</div>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle, autoComplete }) {
  return (
    <label className="cs-field">
      <span className="cs-field__label">{label}</span>
      <span className="cs-password-field">
        <input
          className="cs-input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="cs-password-field__toggle"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings, documents, chats } = useApp();
  const { logout } = useAuth();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordVisible, setPasswordVisible] = useState({ current: false, next: false, confirm: false });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const safeSettings = {
    notifications: true,
    emailNotifications: false,
    theme: "light",
    language: "English",
    accountPrivacy: "private",
    aiResponseStyle: "balanced",
    defaultAnswerFormat: "automatic",
    examMode: false,
    includeExamples: true,
    useDocuments: true,
    preferDocuments: false,
    showCitations: true,
    saveChatHistory: true,
    useChatContext: true,
    autoChatTitles: true,
    ...settings,
  };

  function update(field, value) {
    updateSettings({ [field]: value });
  }

  function openPasswordModal() {
    setPasswords({ current: "", next: "", confirm: "" });
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordOpen(true);
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwords.next.length < 8) {
      setPasswordError("New password must contain at least 8 characters.");
      return;
    }

    if (passwords.next !== passwords.confirm) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (passwords.current === passwords.next) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswordSuccess("Password changed successfully.");
      setPasswords({ current: "", next: "", confirm: "" });
      window.setTimeout(() => setPasswordOpen(false), 900);
    } catch (error) {
      setPasswordError(getApiError(error));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="cs-page-stack cs-settings-page">
      <SectionHeader
        title="Settings"
        subtitle="Personalize your CampusSage AI experience"
      />

      <div className="cs-settings__overview">
        <div>
          <div className="cs-settings__overview-eyebrow">YOUR WORKSPACE</div>
          <h2>Make CampusSage work your way</h2>
          <p>Control your preferences, AI behavior, document assistance, and account security from one place.</p>
        </div>
        <div className="cs-settings__overview-badge">
          <Sparkles size={18} />
          <span>Student workspace</span>
        </div>
      </div>

      <div className="cs-settings__grid cs-settings__grid--new">
        <Card className="cs-settings__card">
          <SectionHeader title="Preferences" subtitle="Control the basic CampusSage experience" />
          <div className="cs-settings__stack cs-settings__stack--rows">
            <SettingRow icon={ShieldCheck} title="Notifications" description="Receive important academic reminders and updates.">
              <Toggle label="" checked={Boolean(safeSettings.notifications)} onChange={(value) => update("notifications", value)} />
            </SettingRow>
            <SettingRow icon={MessageSquare} title="Email notifications" description="Allow important account and academic updates by email.">
              <Toggle label="" checked={Boolean(safeSettings.emailNotifications)} onChange={(value) => update("emailNotifications", value)} />
            </SettingRow>
            <SettingRow icon={Sparkles} title="Theme" description="Choose how the CampusSage interface should look.">
              <Select value={safeSettings.theme} onChange={(event) => update("theme", event.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </Select>
            </SettingRow>
            <SettingRow icon={MessageSquare} title="Language" description="Choose your preferred interface language.">
              <Select value={safeSettings.language} onChange={(event) => update("language", event.target.value)}>
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
                <option value="Hindi">Hindi</option>
              </Select>
            </SettingRow>
          </div>
        </Card>

        <Card className="cs-settings__card">
          <SectionHeader title="AI preferences" subtitle="Customize how CampusSage answers your questions" />
          <div className="cs-settings__stack cs-settings__stack--rows">
            <SettingRow icon={Brain} title="Response style" description="Controls the default level of explanation.">
              <Select value={safeSettings.aiResponseStyle} onChange={(event) => update("aiResponseStyle", event.target.value)}>
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </Select>
            </SettingRow>
            <SettingRow icon={FileText} title="Default answer format" description="Choose how academic answers are normally structured.">
              <Select value={safeSettings.defaultAnswerFormat} onChange={(event) => update("defaultAnswerFormat", event.target.value)}>
                <option value="automatic">Automatic</option>
                <option value="explanation">Explanation</option>
                <option value="step-by-step">Step-by-step</option>
                <option value="bullets">Bullet points</option>
                <option value="exam">Exam answer</option>
                <option value="summary">Summary</option>
              </Select>
            </SettingRow>
            <SettingRow icon={CheckCircle2} title="Exam-oriented answers" description="Prefer structured answers that are easy to revise for exams.">
              <Toggle label="" checked={Boolean(safeSettings.examMode)} onChange={(value) => update("examMode", value)} />
            </SettingRow>
            <SettingRow icon={Sparkles} title="Include examples" description="Include examples when they help explain a concept.">
              <Toggle label="" checked={Boolean(safeSettings.includeExamples)} onChange={(value) => update("includeExamples", value)} />
            </SettingRow>
          </div>
        </Card>

        <Card className="cs-settings__card">
          <SectionHeader title="Knowledge & documents" subtitle="Control how your uploaded study material is used" />
          <div className="cs-settings__stack cs-settings__stack--rows">
            <SettingRow icon={FileText} title="Use uploaded documents" description="Use relevant documents as optional context for AI answers.">
              <Toggle label="" checked={Boolean(safeSettings.useDocuments)} onChange={(value) => update("useDocuments", value)} />
            </SettingRow>
            <SettingRow icon={Brain} title="Prefer document information" description="Give relevant uploaded material priority when answering.">
              <Toggle label="" checked={Boolean(safeSettings.preferDocuments)} onChange={(value) => update("preferDocuments", value)} />
            </SettingRow>
            <SettingRow icon={FileText} title="Show citations" description="Show document and page references when sources are used.">
              <Toggle label="" checked={Boolean(safeSettings.showCitations)} onChange={(value) => update("showCitations", value)} />
            </SettingRow>
          </div>
          <div className="cs-settings__mini-stat">
            <span><FileText size={15} /> Indexed documents</span>
            <strong>{documents.length}</strong>
          </div>
        </Card>

        <Card className="cs-settings__card">
          <SectionHeader title="Chat preferences" subtitle="Choose how conversations are saved and continued" />
          <div className="cs-settings__stack cs-settings__stack--rows">
            <SettingRow icon={MessageSquare} title="Save chat history" description="Keep conversations available in Chat History.">
              <Toggle label="" checked={Boolean(safeSettings.saveChatHistory)} onChange={(value) => update("saveChatHistory", value)} />
            </SettingRow>
            <SettingRow icon={Brain} title="Use conversation context" description="Allow follow-up questions to use earlier messages.">
              <Toggle label="" checked={Boolean(safeSettings.useChatContext)} onChange={(value) => update("useChatContext", value)} />
            </SettingRow>
            <SettingRow icon={Sparkles} title="Automatic chat titles" description="Create useful titles from the first question.">
              <Toggle label="" checked={Boolean(safeSettings.autoChatTitles)} onChange={(value) => update("autoChatTitles", value)} />
            </SettingRow>
          </div>
          <div className="cs-settings__mini-stat">
            <span><MessageSquare size={15} /> Saved conversations</span>
            <strong>{chats.length}</strong>
          </div>
        </Card>

        <Card className="cs-settings__card cs-settings__card--security">
          <SectionHeader title="Account & security" subtitle="Protect your CampusSage account" />
          <div className="cs-security-card">
            <div className="cs-security-card__icon"><Lock size={20} /></div>
            <div className="cs-security-card__copy">
              <strong>Password</strong>
              <span>Change your account password whenever you need to.</span>
            </div>
            <Button variant="secondary" onClick={openPasswordModal}>Change password</Button>
          </div>
          <div className="cs-security-card cs-security-card--privacy">
            <div className="cs-security-card__icon"><ShieldCheck size={20} /></div>
            <div className="cs-security-card__copy">
              <strong>Privacy</strong>
              <span>Your account is currently set to private.</span>
            </div>
            <Select value={safeSettings.accountPrivacy} onChange={(event) => update("accountPrivacy", event.target.value)}>
              <option value="private">Private</option>
              <option value="shared">Shared</option>
            </Select>
          </div>
          <Button variant="danger" onClick={() => { logout(); navigate("/login"); }}>
            Logout
          </Button>
        </Card>
      </div>

      <div className="cs-settings__footer-note">
        <ShieldCheck size={16} />
        <span>Your settings are stored with your CampusSage account and applied to your workspace.</span>
      </div>

      <Modal open={passwordOpen} title="Change password" onClose={() => !changingPassword && setPasswordOpen(false)} width="medium">
        <form className="cs-modal-form cs-password-form" onSubmit={handlePasswordChange}>
          <div className="cs-password-intro">
            <div className="cs-password-intro__icon"><Lock size={20} /></div>
            <div>
              <strong>Secure your account</strong>
              <span>Use a password with at least 8 characters.</span>
            </div>
          </div>

          <PasswordField label="Current password" value={passwords.current} onChange={(event) => setPasswords((current) => ({ ...current, current: event.target.value }))} visible={passwordVisible.current} onToggle={() => setPasswordVisible((current) => ({ ...current, current: !current.current }))} autoComplete="current-password" />
          <PasswordField label="New password" value={passwords.next} onChange={(event) => setPasswords((current) => ({ ...current, next: event.target.value }))} visible={passwordVisible.next} onToggle={() => setPasswordVisible((current) => ({ ...current, next: !current.next }))} autoComplete="new-password" />
          <PasswordField label="Confirm new password" value={passwords.confirm} onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))} visible={passwordVisible.confirm} onToggle={() => setPasswordVisible((current) => ({ ...current, confirm: !current.confirm }))} autoComplete="new-password" />

          {passwordError ? <div className="cs-settings__message cs-settings__message--error">{passwordError}</div> : null}
          {passwordSuccess ? <div className="cs-settings__message cs-settings__message--success"><CheckCircle2 size={16} /> {passwordSuccess}</div> : null}

          <div className="cs-form-grid__actions cs-password-form__actions">
            <Button type="button" variant="secondary" onClick={() => setPasswordOpen(false)} disabled={changingPassword}>Cancel</Button>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change password"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
