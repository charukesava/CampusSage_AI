import { apiClient } from "./api";

export const getSubjects = async () => (await apiClient.get("/subjects")).data;

export const createSubject = async ({ name, semester }) =>
  (await apiClient.post("/subjects", { name, semester })).data;

export const joinSubject = async (joinCode) =>
  (await apiClient.post("/subjects/join", { joinCode })).data;

export const getSubjectMessages = async (subjectId) =>
  (await apiClient.get(`/subjects/${subjectId}/messages`)).data;

export const sendSubjectMessage = async (subjectId, { content, isAnnouncement, file }) => {
  const form = new FormData();
  form.append("content", content || "");
  if (isAnnouncement) form.append("isAnnouncement", "true");
  if (file) form.append("file", file);
  return (
    await apiClient.post(`/subjects/${subjectId}/messages`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  ).data;
};

export const togglePinMessage = async (subjectId, messageId, pinned) =>
  (await apiClient.patch(`/subjects/${subjectId}/messages/${messageId}`, { pinned })).data;

export const deleteSubjectMessage = async (subjectId, messageId) => {
  await apiClient.delete(`/subjects/${subjectId}/messages/${messageId}`);
};

export const getSubjectMembers = async (subjectId) =>
  (await apiClient.get(`/subjects/${subjectId}/members`)).data;

export const removeSubjectMember = async (subjectId, userId) => {
  await apiClient.delete(`/subjects/${subjectId}/members/${userId}`);
};

export const addSubjectMember = async (subjectId, userId) =>
  (await apiClient.post(`/subjects/${subjectId}/members`, { userId })).data;

export const searchStudents = async (query) =>
  (await apiClient.get(`/students/search`, { params: { q: query } })).data;

export const fetchAttachmentBlob = async (subjectId, messageId) =>
  (await apiClient.get(`/subjects/${subjectId}/messages/${messageId}/file`, { responseType: "blob" })).data;
