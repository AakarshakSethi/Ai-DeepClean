import apiClient from "./client";

export async function runSync(userId, maxResults = 50) {
  const autoDeleteOtps = localStorage.getItem("deepclean_autodelete_otps") === "true";
  const autoDeletePromos = localStorage.getItem("deepclean_autodelete_promos") === "true";

  const response = await apiClient.post("/gmail-sync/run", null, {
    params: { 
      user_id: userId, 
      max_results: maxResults,
      autodelete_otps: autoDeleteOtps,
      autodelete_promos: autoDeletePromos
    },
  });
  return response.data;
}
