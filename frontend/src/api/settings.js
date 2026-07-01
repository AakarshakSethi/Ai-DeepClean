import apiClient from "./client";

export async function disconnectGmail(userId) {
  const response = await apiClient.post("/settings/disconnect-gmail", null, {
    params: { user_id: userId },
  });
  return response.data;
}

export async function deleteMyData(userId) {
  const response = await apiClient.delete("/settings/delete-my-data", {
    params: { user_id: userId },
  });
  return response.data;
}
