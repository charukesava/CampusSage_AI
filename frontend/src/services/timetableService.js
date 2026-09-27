import { apiClient } from "./api";

export const getTimetable = async () => (await apiClient.get("/timetable")).data;
export const createTimetableClass = async (entry) => (await apiClient.post("/timetable", entry)).data;
export const updateTimetableClass = async (id, entry) => (await apiClient.patch(`/timetable/${id}`, entry)).data;
export const deleteTimetableClass = async (id) => { await apiClient.delete(`/timetable/${id}`); };

const nativeTimetableImages = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

async function normalizeImageForUpload(file) {
  if (nativeTimetableImages.has(file.type)) return file;
  if (!file.type.startsWith("image/")) return file;

  // Convert browser-decodable image formats (for example GIF/BMP) to PNG so
  // the backend/Gemini pipeline receives a consistent, widely supported type.
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not convert the selected image.");

    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.png`, { type: "image/png" });
  } catch {
    throw new Error("This image format could not be read by your browser. Please use JPG, PNG, WEBP, HEIC, HEIF, or PDF.");
  }
}

export async function previewTimetableFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The timetable file must be 10 MB or smaller.");
  }

  const uploadFile = await normalizeImageForUpload(file);
  const formData = new FormData();
  formData.append("file", uploadFile);
  return (await apiClient.post("/timetable/import/preview", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
}

export async function saveImportedTimetable(entries, replaceExisting = true) {
  return (await apiClient.put("/timetable/bulk", { entries, replaceExisting })).data;
}

export function sortTimetable(timetable) {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return [...timetable].sort((a,b) => order.indexOf(a.day)-order.indexOf(b.day) || a.startTime.localeCompare(b.startTime));
}
