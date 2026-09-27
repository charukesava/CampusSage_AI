import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createInitialState } from "../data/mockData";
import { useAuth } from "./AuthContext";
import { apiClient, getApiError } from "../services/api";
import { uploadDocuments, renameDocument as renameDocumentApi, deleteDocument as deleteDocumentApi, organizeDocument as organizeDocumentApi } from "../services/documentService";
import { saveProfile } from "../services/profileService";
import { saveSettings } from "../services/settingsService";
import { createTimetableClass, updateTimetableClass as updateTimetableClassApi, deleteTimetableClass as deleteTimetableClassApi, saveImportedTimetable, sortTimetable } from "../services/timetableService";
import { generateNotices, saveNotices, markNoticeReadApi, deleteNoticeApi } from "../services/noticesService";
import { generateStudyPlan, savePlanner, togglePlannerTask as togglePlannerTaskApi } from "../services/plannerService";
import { createChat, sendChatMessage } from "../services/chatService";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const defaults = useMemo(() => createInitialState(), []);
  const [profile, setProfile] = useState(defaults.profile);
  const [settings, setSettingsState] = useState(defaults.settings);
  const [documents, setDocuments] = useState(defaults.documents);
  const [timetable, setTimetable] = useState(defaults.timetable);
  const [notices, setNotices] = useState(defaults.notices);
  const [planner, setPlanner] = useState(defaults.planner);
  const [chats, setChats] = useState(defaults.chats);
  const [activeChatId, setActiveChatId] = useState(defaults.activeChatId);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [dataLoading, setDataLoading] = useState(Boolean(isAuthenticated));

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(defaults.profile); setSettingsState(defaults.settings); setDocuments([]);
      setTimetable([]); setNotices([]); setPlanner(defaults.planner); setChats([]);
      setActiveChatId(null); setDataLoading(false); return;
    }
    setDataLoading(true);
    apiClient.get("/bootstrap")
      .then(({ data }) => {
        setProfile(data.profile || defaults.profile);
        setSettingsState(data.settings || defaults.settings);
        setDocuments(data.documents || []);
        setTimetable(data.timetable || []);
        setNotices(data.notices || []);
        setPlanner(data.planner || defaults.planner);
        setChats(data.chats || []);
        setActiveChatId(data.activeChatId || data.chats?.[0]?.id || null);
      })
      .catch((error) => setChatError(getApiError(error)))
      .finally(() => setDataLoading(false));
  }, [isAuthenticated, defaults]);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hasProcessingDocument = documents.some((doc) => doc.status === "processing");
    if (!hasProcessingDocument) return;
    const timer = window.setInterval(() => {
      apiClient.get("/documents").then(({ data }) => setDocuments(data)).catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, documents]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || chats[0] || null;

  const metrics = useMemo(() => {
    const todayName = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date()).slice(0, 3);
    const todayClasses = timetable.filter((entry) => entry.day === todayName).length;
    const pendingAssignments = notices.filter((notice) => !notice.read && notice.type === "Assignment").length;
    return { documents: documents.length, subjects: profile.subjects.length, todayClasses, pendingAssignments, recentChats: chats.length, upcomingClasses: timetable.slice(0, 3), recentUploads: documents.slice(0, 4) };
  }, [documents, profile.subjects.length, timetable, chats, notices]);

  function updateProfile(updater) {
    setProfile((current) => {
      const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      saveProfile(next).catch((e) => setChatError(getApiError(e)));
      return next;
    });
  }

  function updateSettings(updater) {
    setSettingsState((current) => {
      const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      saveSettings(next).catch((e) => setChatError(getApiError(e)));
      return next;
    });
  }

  async function addDocuments(files, metadata = {}) {
    try {
      setUploadProgress(5);
      const incoming = await uploadDocuments(files, setUploadProgress, metadata);
      setDocuments((current) => [...incoming, ...current]);
      setUploadProgress(100);
      window.setTimeout(() => setUploadProgress(0), 700);
    } catch (error) {
      setUploadProgress(0);
      setChatError(getApiError(error));
    }
  }

  async function renameDocument(id, name) {
    try { const updated = await renameDocumentApi(id, name); setDocuments((current) => current.map((d) => d.id === id ? updated : d)); }
    catch (error) { setChatError(getApiError(error)); }
  }

  async function removeDocument(id) {
    try { await deleteDocumentApi(id); setDocuments((current) => current.filter((d) => d.id !== id)); }
    catch (error) { setChatError(getApiError(error)); }
  }



  async function organizeDocument(id, organization) {
    try {
      const updated = await organizeDocumentApi(id, organization);
      setDocuments((current) => current.map((d) => d.id === id ? updated : d));
      return updated;
    } catch (error) {
      setChatError(getApiError(error));
      throw error;
    }
  }

  async function addTimetableClass(entry) {
    try { const created = await createTimetableClass(entry); setTimetable((current) => sortTimetable([...current, created])); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function updateTimetableClass(id, entry) {
    try { const updated = await updateTimetableClassApi(id, entry); setTimetable((current) => sortTimetable(current.map((item) => item.id === id ? updated : item))); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function deleteTimetableClass(id) {
    try { await deleteTimetableClassApi(id); setTimetable((current) => current.filter((entry) => entry.id !== id)); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function importTimetable(entries, replaceExisting = true) {
    try {
      const saved = await saveImportedTimetable(entries, replaceExisting);
      setTimetable(sortTimetable(saved));
      return saved;
    } catch (error) {
      setChatError(getApiError(error));
      throw error;
    }
  }

  async function markNoticeRead(id) {
    try { const updated = await markNoticeReadApi(id, true); setNotices((current) => current.map((n) => n.id === id ? updated : n)); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function deleteNotice(id) {
    try { await deleteNoticeApi(id); setNotices((current) => current.filter((n) => n.id !== id)); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function regenerateNotices() {
    const auto = generateNotices(timetable, planner);
    const manual = notices.filter((n) => !n.id.startsWith("auto-") && !n.id.startsWith("planner-"));
    const next = [...auto, ...manual];
    try { const saved = await saveNotices(next); setNotices(saved); }
    catch (error) { setChatError(getApiError(error)); }
  }

  async function updatePlanner(planInput) {
    const nextTasks = generateStudyPlan(planInput);
    const nextPlanner = { ...planner, ...planInput, tasks: nextTasks };
    setPlanner(nextPlanner);
    try { const saved = await savePlanner(nextPlanner); setPlanner(saved); }
    catch (error) { setChatError(getApiError(error)); }
  }
  async function togglePlannerTask(taskId) {
    const task = planner.tasks.find((item) => item.id === taskId);
    if (!task) return;
    try { const updated = await togglePlannerTaskApi(taskId, !task.done); setPlanner((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? updated : item) })); }
    catch (error) { setChatError(getApiError(error)); }
  }
  const markTaskDone = togglePlannerTask;

  async function startNewChat() {
    try { const chat = await createChat("New conversation"); setChats((current) => [chat, ...current]); setActiveChatId(chat.id); return chat.id; }
    catch (error) { setChatError(getApiError(error)); return null; }
  }
  function selectChat(id) { setActiveChatId(id); }

  async function sendMessage(text, options = {}) {
    if (!text.trim()) return;
    setChatError("");
    let currentChatId = activeChatId || chats[0]?.id;
    if (!currentChatId) currentChatId = await startNewChat();
    if (!currentChatId) return;
    setChatLoading(true);
    try {
      const response = await sendChatMessage(currentChatId, text.trim(), options.addUserMessage !== false);
      setChats((current) => current.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const messages = [...(chat.messages || [])];
        if (response.userMessage) messages.push(response.userMessage);
        messages.push(response.assistantMessage);
        return { ...chat, title: chat.title === "New conversation" ? text.trim().slice(0,32) : chat.title, updatedAt: new Date().toISOString(), messages };
      }));
    } catch (error) { setChatError(getApiError(error)); }
    finally { setChatLoading(false); }
  }

  async function regenerateLastReply() {
    const latest = [...(activeChat?.messages || [])].reverse().find((m) => m.role === "user");
    if (latest) await sendMessage(latest.content, { addUserMessage: false });
  }

  const value = useMemo(() => ({ profile, settings, documents, timetable, notices, planner, chats, activeChatId, activeChat, metrics, uploadProgress, chatLoading, chatError, dataLoading, updateProfile, updateSettings, addDocuments, organizeDocument, renameDocument, removeDocument, addTimetableClass, updateTimetableClass, deleteTimetableClass, importTimetable, markNoticeRead, deleteNotice, regenerateNotices, updatePlanner, togglePlannerTask, startNewChat, selectChat, sendMessage, regenerateLastReply, markTaskDone, setChatError }), [profile, settings, documents, timetable, notices, planner, chats, activeChatId, activeChat, metrics, uploadProgress, chatLoading, chatError, dataLoading, importTimetable]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { const context = useContext(AppContext); if (!context) throw new Error("useApp must be used within AppProvider"); return context; }
