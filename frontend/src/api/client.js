/**
 * api/client.js
 * Shared axios instance pointing to your FastAPI backend.
 * Every other api/*.js file imports this instead of creating its own axios setup.
 */

import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`,
});

export default apiClient;
