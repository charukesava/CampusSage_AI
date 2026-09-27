import { useRef, useState } from "react";
import { Bell, Menu, Search, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import NotificationPanel from "../notifications/NotificationPanel";

export default function Topbar({
  onMenuClick,
  title = "Dashboard",
  subtitle = "How can I help you today?",
}) {
  const { user } = useAuth();
  const { metrics } = useApp();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const bellRef = useRef(null);

  return (
    <header className="cs-topbar">
      <div className="cs-topbar__titleblock">
        <button
          className="cs-icon-button cs-topbar__menu"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="cs-topbar__actions">
        <div className="cs-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search anything..."
            aria-label="Search"
          />
        </div>
        <div className="cs-topbar__notify-wrap">
          <button
            ref={bellRef}
            className="cs-icon-button cs-topbar__notify"
            aria-label="Notifications"
            onClick={() => setIsNotifOpen((open) => !open)}
          >
            <Bell size={17} />
            <span className="cs-topbar__dot" />
          </button>
          <NotificationPanel open={isNotifOpen} onClose={() => setIsNotifOpen(false)} anchorRef={bellRef} />
        </div>
        <div className="cs-avatar" title={user?.name || "Student"}>
          {user?.name?.slice(0, 1) || "S"}
        </div>
      </div>

      <div className="cs-topbar__stats">
        <span>
          <Sparkles size={14} /> {metrics.documents} documents indexed
        </span>
      </div>
    </header>
  );
}
