import apiClient from "./client";

export async function searchEmails(userId, query) {
  const response = await apiClient.get("/search/", {
    params: { user_id: userId, query },
  });
  return response.data;
}
