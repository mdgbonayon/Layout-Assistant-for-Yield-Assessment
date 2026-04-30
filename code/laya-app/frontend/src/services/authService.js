import { apiFetch } from "../api";

export async function loginUser(formData) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(formData),
  });

  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));

  return data;
}

export async function registerUser(formData) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

export async function fetchCurrentUser() {
  return apiFetch("/auth/me");
}

export async function fetchPendingUsers() {
  return apiFetch("/admin/pending-users");
}

export async function approveUser(userId) {
  return apiFetch(`/admin/users/${userId}/approve`, {
    method: "PATCH",
  });
}

export async function rejectUser(userId) {
  return apiFetch(`/admin/users/${userId}/reject`, {
    method: "PATCH",
  });
}

export async function fetchDeletionRequests() {
  return apiFetch("/admin/deletion-requests");
}

export async function approveDeletionRequest(requestId) {
  return apiFetch(`/admin/deletion-requests/${requestId}/approve`, {
    method: "PATCH",
  });
}

export async function rejectDeletionRequest(requestId) {
  return apiFetch(`/admin/deletion-requests/${requestId}/reject`, {
    method: "PATCH",
  });
}