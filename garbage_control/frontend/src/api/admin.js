import http from "./http";

export async function me() {
  const res = await http.get("/api/auth/me/");
  return res.data;
}

export async function listRequests() {
  const res = await http.get("/api/requests/");
  return res.data; // DRF обычно возвращает массив (если без пагинации)
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
