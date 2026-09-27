export const mockProfile = {
  name: "Student",
  registerNumber: "",
  department: "",
  semester: "",
  collegeName: "",
  preferredLanguage: "English",
  subjects: [],
  email: "",
  phone: "",
};

export const mockSettings = {
  theme: "light",
  notifications: true,
  language: "English",
  accountPrivacy: "private",
};

export const mockDocuments = [];

export const mockTimetable = [];

export const mockNotices = [];

export const mockPlanner = {
  examDate: "",
  availableHours: 0,
  priority: "Medium",
  subjects: [],
  tasks: [],
};

export const mockChats = [];

export function createInitialState() {
  return {
    profile: mockProfile,
    settings: mockSettings,
    documents: mockDocuments,
    timetable: mockTimetable,
    notices: mockNotices,
    planner: mockPlanner,
    chats: mockChats,
    activeChatId: null,
    uploadProgress: 0,
  };
}
