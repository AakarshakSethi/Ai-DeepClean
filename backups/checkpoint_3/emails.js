/**
 * api/emails.js
 * Calls your FastAPI backend's /emails endpoints.
 */

import apiClient from "./client";

export async function getStorageSummary(userId) {
  const response = await apiClient.get("/emails/storage-summary", {
    params: { user_id: userId },
  });
  return response.data;
}

export async function listEmails(userId, category = null) {
  const params = { user_id: userId };
  if (category) params.category = category;

  const response = await apiClient.get("/emails/", { params });
  return response.data;
}

export async function getEmailDetails(emailId, userId) {
  const response = await apiClient.get(`/emails/${emailId}/details`, {
    params: { user_id: userId },
  });
  return response.data;
}

export function getAttachmentDownloadUrl(emailId, attachmentId, userId, filename) {
  return `${apiClient.defaults.baseURL}/emails/${emailId}/attachments/${attachmentId}?user_id=${userId}&filename=${encodeURIComponent(filename)}`;
}

export async function sendEmail(userId, toEmail, subject, body) {
  const response = await apiClient.post("/emails/send", {
    to_email: toEmail,
    subject: subject,
    body: body,
  }, {
    params: { user_id: userId },
  });
  return response.data;
}
