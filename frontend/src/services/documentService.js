import { apiClient, getApiError } from "./api";

export async function uploadDocuments(files, onProgress, metadata = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  if (metadata.semester) formData.append("semester", metadata.semester);
  if (metadata.subject) formData.append("subject", metadata.subject);
  if (metadata.category) formData.append("category", metadata.category);
  try {
    const { data } = await apiClient.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
    return data;
  } catch (error) {
    throw new Error(getApiError(error));
  }
}

export async function renameDocument(id, name) {
  const { data } = await apiClient.patch(`/documents/${id}`, { name });
  return data;
}

export async function deleteDocument(id) {
  await apiClient.delete(`/documents/${id}`);
}

export async function openDocumentFile(id) {
  const response = await apiClient.get(`/documents/${id}/file`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}


export async function organizeDocument(id, organization) {
  const { data } = await apiClient.patch(`/documents/${id}`, organization);
  return data;
}
