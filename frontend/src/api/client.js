/**
 * api/client.js
 * Shared axios instance pointing to your FastAPI backend.
 * Every other api/*.js file imports this instead of creating its own axios setup.
 */

import axios from "axios";

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  // If running in a Capacitor/Native app, localhost/hostname refers to the phone itself.
  // We need to point to the computer running the backend.
  const isNative = window.location.protocol === 'capacitor:';
  if (isNative) {
    return 'http://10.0.2.2:8000'; // Standard Android Emulator bridge
  }

  return `http://${window.location.hostname}:8000`;
};

const apiClient = axios.create({
  baseURL: getBaseURL(),
});

export default apiClient;
