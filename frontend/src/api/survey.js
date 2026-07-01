import apiClient from "./client";

export async function getPendingSurveys(userId, limit = 10) {
  const response = await apiClient.get("/survey/pending", {
    params: { user_id: userId, limit },
  });
  return response.data;
}

export async function submitSurvey(userId, emailId, priority, classification, keepOrDelete, willNeedAgain) {
  const response = await apiClient.post("/survey/answer", null, {
    params: {
      user_id: userId,
      email_id: emailId,
      priority,
      classification,
      keep_or_delete: keepOrDelete,
      will_need_again: willNeedAgain,
    },
  });
  return response.data;
}
