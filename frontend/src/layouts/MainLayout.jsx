import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import ClassReminderToast from "../components/notifications/ClassReminderToast";

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="cs-shell">
      {isSidebarOpen ? (
        <div
          className="cs-sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
          role="presentation"
        />
      ) : null}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="cs-shell__main">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="cs-content">
          <Outlet />
        </main>
      </div>
      <ClassReminderToast />
    </div>
  );
}
