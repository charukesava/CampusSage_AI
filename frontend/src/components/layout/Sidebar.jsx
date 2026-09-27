import {
  BookOpen,
  Brain,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  UserCog,
  Settings,
  ScrollText,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Button from "../common/Button";

const studentNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "AI Assistant", icon: Brain },
  { to: "/library", label: "Documents", icon: BookOpen },
  { to: "/timetable", label: "Timetable", icon: CalendarRange },
  { to: "/notices", label: "Notices", icon: ScrollText },
  { to: "/campus-connect", label: "CampusConnect", icon: MessageCircle },
  { to: "/planner", label: "Study Planner", icon: UserCog },
  { to: "/profile", label: "Profile", icon: UserCog },
  { to: "/settings", label: "Settings", icon: Settings },
];

const teacherNavItems = studentNavItems.filter((item) => item.to !== "/timetable");

export default function Sidebar({ onClose, isOpen }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const navItems = user?.role === "teacher" ? teacherNavItems : studentNavItems;

  return (
    <aside className={`cs-sidebar ${isOpen ? "is-open" : ""}`}>
      <div className="cs-sidebar__brand">
        <div className="cs-brand-mark">CS</div>
        <div>
          <div className="cs-brand-title">CampusSage AI</div>
          <div className="cs-brand-subtitle">{user?.role === "teacher" ? "Teacher workspace" : "Student workspace"}</div>
        </div>
        <button
          className="cs-icon-button cs-sidebar__close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="cs-sidebar__nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `cs-sidebar__link ${isActive ? "is-active" : ""}`
            }
            onClick={onClose}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="cs-sidebar__footer">
        <Button
          variant="ghost"
          className="cs-sidebar__logout"
          onClick={() => {
            onClose?.();
            logout();
            navigate("/login");
          }}
        >
          <LogOut size={16} /> Logout
        </Button>
      </div>
    </aside>
  );
}
