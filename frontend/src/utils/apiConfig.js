// API configuration for frontend
// Use VITE_ prefix for Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://cooking-assistant-app-backend.onrender.com';

export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};
