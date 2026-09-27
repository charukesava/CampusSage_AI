import { apiClient } from "./api";
export const getProfile = async () => (await apiClient.get("/profile")).data;
export const saveProfile = async (profile) => (await apiClient.patch("/profile", profile)).data;
