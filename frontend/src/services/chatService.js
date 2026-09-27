import { apiClient } from "./api";
export const getChats = async () => (await apiClient.get("/chats")).data;
export const createChat = async (title) => (await apiClient.post("/chats", { title })).data;
export const sendChatMessage = async (chatId, content, includeUserMessage = true) => (await apiClient.post(`/chats/${chatId}/messages`, { content, includeUserMessage })).data;
export function createSuggestedQuestions() { return ["What is the attendance requirement?","Summarize DBMS Unit 2","Do I have lab tomorrow?","Create a revision plan for CN"]; }
