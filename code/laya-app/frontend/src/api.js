const API_BASE_URL = "http://localhost:5000/api";

export function getToken() {
  return localStorage.getItem("token");
}

export function getStoredUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}