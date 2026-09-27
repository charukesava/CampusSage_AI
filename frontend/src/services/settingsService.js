import { apiClient } from "./api";

export const getSettings = async () => (await apiClient.get("/settings")).data;

export const saveSettings = async (settings) =>
  (await apiClient.patch("/settings", settings)).data;

export const changePassword = async (currentPassword, newPassword) =>
  (await apiClient.post("/auth/change-password", { currentPassword, newPassword })).data;
