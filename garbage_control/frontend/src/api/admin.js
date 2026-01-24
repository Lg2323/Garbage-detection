import http from "./http";

export async function me() {
  const res = await http.get("/api/auth/me/");
  return res.data;
}

export async function listRequests(params = {}) {
  const res = await http.get("/api/requests/", { params });
  return res.data;
}

export async function getRequest(id) {
  const res = await http.get(`/api/requests/${id}/`);
  return res.data;
}

export async function listWorkers() {
  const res = await http.get("/api/auth/workers/");
  return res.data;
}

export async function assignWorker(requestId, workerId) {
  const res = await http.post(`/api/requests/${requestId}/assign_worker/`, {
    worker_id: workerId,
  });
  return res.data;
}

export async function listUsers(q = "") {
  const res = await http.get("/api/admin/users/", { params: q ? { q } : {} });
  return res.data;
}

export async function createUser(payload) {
  const res = await http.post("/api/admin/users/", payload);
  return res.data;
}

export async function updateUser(id, payload) {
  const res = await http.patch(`/api/admin/users/${id}/`, payload);
  return res.data;
}

export async function adminStats() {
  const res = await http.get("/api/admin/stats/");
  return res.data;
}

export async function setRequestStatus(requestId, status) {
  const res = await http.post(`/api/requests/${requestId}/set_status/`, { status });
  return res.data;
}
