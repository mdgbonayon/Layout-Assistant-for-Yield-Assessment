import { apiFetch } from "../api";

export async function fetchRecentActivityLogs() {
  return apiFetch("/activity-logs/recent");
}

export async function fetchExperiments() {
  return apiFetch("/experiments");
}

export async function createExperiment(experimentData) {
  return apiFetch("/experiments", {
    method: "POST",
    body: JSON.stringify(experimentData),
  });
}

export async function fetchExperimentById(id) {
  return apiFetch(`/experiments/${id}`);
}

export async function generateLayout(id) {
  return apiFetch(`/experiments/${id}/generate-layout`, {
    method: "POST",
  });
}

export async function fetchLayouts(id) {
  return apiFetch(`/experiments/${id}/layouts`);
}

export async function setActiveLayoutBatch(id, batchId) {
  return apiFetch(`/experiments/${id}/layout-batches/${batchId}/activate`, {
    method: "PATCH",
  });
}

export async function deleteLayoutBatch(id, batchId) {
  return apiFetch(`/experiments/${id}/layout-batches/${batchId}`, {
    method: "DELETE",
  });
}

export async function deleteAllLayouts(id) {
  return apiFetch(`/experiments/${id}/layouts`, {
    method: "DELETE",
  });
}

export async function submitDeletionRequests(experimentIds, reason = "") {
  return apiFetch("/experiments/delete-requests", {
    method: "POST",
    body: JSON.stringify({
      experiment_ids: experimentIds,
      reason,
    }),
  });
}

export async function fetchPlantingPlanReport(id) {
  return apiFetch(`/experiments/${id}/planting-plan`);
}

export async function updatePlantingPlanRemark(id, payload) {
  return apiFetch(`/experiments/${id}/planting-plan/remarks`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function saveExperimentPolygon(id, polygonData) {
  return apiFetch(`/experiments/${id}/polygon`, {
    method: "POST",
    body: JSON.stringify(polygonData),
  });
}

export async function fetchExperimentPolygon(id) {
  return apiFetch(`/experiments/${id}/polygon`);
}

export async function fetchAllExperimentPolygons() {
  return apiFetch("/experiments/polygons");
}