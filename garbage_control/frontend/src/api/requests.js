import http from "./http";

export async function getRequests(params = {}) {
  const res = await http.get("/api/requests/", { params });
  return res.data;
}

export async function getCompletedRequests(params = {}) {
  const res = await http.get("/api/requests/completed/", { params });
  return res.data;
}

export async function getCityStats(filters = {}) {
  const params =
    typeof filters === "string"
      ? (filters ? { city: filters } : undefined)
      : filters;
  const res = await http.get("/api/requests/stats/", { params });
  return res.data;
}

export async function getRequest(id) {
  const res = await http.get(`/api/requests/${id}/`);
  return res.data;
}

export async function getRequestReferenceOptions() {
  const res = await http.get("/api/requests/reference_options/");
  return res.data;
}

export async function createRequest({ title, address = "", city = "", latitude, longitude, beforePhoto }) {
  const form = new FormData();
  form.append("title", title);
  form.append("address", address);
  form.append("latitude", latitude);
  form.append("longitude", longitude);
  form.append("city", city);
  form.append("before_photo", beforePhoto);

  const res = await http.post("/api/requests/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function assignWorker(id, worker_id) {
  const res = await http.post(`/api/requests/${id}/assign_worker/`, { worker_id });
  return res.data;
}

export async function organizationAssignRequest(id, payload) {
  const res = await http.post(`/api/requests/${id}/organization-assign/`, payload);
  return res.data;
}

export async function departmentAssignRequest(id, payload) {
  const res = await http.post(`/api/requests/${id}/department-assign/`, payload);
  return res.data;
}

export async function classifyRequest(id, payload) {
  const res = await http.post(`/api/requests/${id}/classify/`, payload);
  return res.data;
}

export async function externalTransferRequest(id, payload) {
  const res = await http.post(`/api/requests/${id}/external-transfer/`, payload);
  return res.data;
}

export async function takeInWork(id) {
  const res = await http.post(`/api/requests/${id}/take_in_work/`);
  return res.data;
}

export async function uploadAfterPhoto(id, afterPhoto) {
  const form = new FormData();
  form.append("after_photo", afterPhoto);
  const res = await http.post(`/api/requests/${id}/upload_after_photo/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function returnToWork(id, payload) {
  const res = await http.post(`/api/requests/${id}/return_to_work/`, payload);
  return res.data;
}

export async function verifyRequest(id, payload = {}) {
  const res = await http.post(`/api/requests/${id}/verify/`, payload);
  return res.data;
}
