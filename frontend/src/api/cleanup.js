import apiClient from "./client";

export async function getReviewBatch(userId) {
  const response = await apiClient.get("/cleanup/review-30", {
    params: { user_id: userId },
  });
  return response.data;
}

export async function approveAction(userId, emailId, action) {
  const response = await apiClient.post("/cleanup/approve-action", null, {
    params: { user_id: userId, email_id: emailId, action },
  });
  return response.data;
}

export async function completeBatch(userId, storageFreedBytes) {
  const response = await apiClient.post("/cleanup/complete-batch", null, {
    params: { user_id: userId, storage_freed_bytes: storageFreedBytes },
  });
  return response.data;
}

export async function approveActions(userId, emailIds, action) {
  const response = await apiClient.post("/cleanup/approve-actions", emailIds, {
    params: { user_id: userId, action },
  });
  return response.data;
}
