import apiClient from "./client";

export async function connectGmail(userEmail) {
  const response = await apiClient.post("/auth/connect-gmail", null, {
    params: { user_email: userEmail },
  });
  return response.data;
}

export async function getCurrentUser(userEmail) {
  const response = await apiClient.get("/auth/me", {
    params: { user_email: userEmail },
  });
  return response.data;
}
