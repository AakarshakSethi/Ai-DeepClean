import { useState, useEffect } from "react";
import { getStorageSummary } from "../api/emails";

export function useStorageSummary(userId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = () => {
    if (!userId) return;

    setLoading(true);
    getStorageSummary(userId)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load storage summary");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSummary();
  }, [userId]);

  return { data, loading, error, refetch: fetchSummary };
}