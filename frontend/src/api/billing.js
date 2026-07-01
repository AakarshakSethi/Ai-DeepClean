import apiClient from "./client";

export async function getPlan(userId) {
  const response = await apiClient.get("/billing/plan", {
    params: { user_id: userId },
  });
  return response.data;
}

export async function upgradePlan(userId) {
  const response = await apiClient.post("/billing/upgrade", null, {
    params: { user_id: userId },
  });
  return response.data;
}
