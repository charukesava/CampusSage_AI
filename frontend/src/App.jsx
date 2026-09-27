import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import Chat from "./pages/Chat";
import Library from "./pages/Library";
import Timetable from "./pages/Timetable";
import Notices from "./pages/Notices";
import CampusConnect from "./pages/CampusConnect";
import StudyPlanner from "./pages/StudyPlanner";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-loader-screen">Loading CampusSage AI...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function StudentOnlyRoute({ children }) {
  const { user } = useAuth();
  if (user?.role === "teacher") return <Navigate to="/campus-connect" replace />;
  return children;
}

function DashboardRoute() {
  const { user } = useAuth();
  return user?.role === "teacher" ? <TeacherDashboard /> : <Dashboard />;
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/library" element={<Library />} />
        <Route path="/timetable" element={<StudentOnlyRoute><Timetable /></StudentOnlyRoute>} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/campus-connect" element={<CampusConnect />} />
        <Route path="/planner" element={<StudyPlanner />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />
    </Routes>
  );
}

export default App;
