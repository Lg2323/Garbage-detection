import http from "./http";

export async function getWorkers() {
  const res = await http.get("/api/auth/workers/");
  return res.data;
}

export async function getAllRequests({ status, q } = {}) {
  const params = {};
  if (status) params.status = status;
  if (q) params.q = q;
  const res = await http.get("/api/requests/", { params });
  return res.data;
}

export async function assignWorker(requestId, workerId) {
  const res = await http.post(`/api/requests/${requestId}/assign_worker/`, { worker_id: workerId });
  return res.data;
}

export async function verifyRequest(requestId) {
  const res = await http.post(`/api/requests/${requestId}/verify/`, {});
  return res.data;
}
