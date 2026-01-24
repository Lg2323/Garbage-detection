import http from "./http";

export async function getRequests() {
  const res = await http.get("/api/requests/");
  return res.data;
}

export async function getRequest(id) {
  const res = await http.get(`/api/requests/${id}/`);
  return res.data;
}

export async function createRequest({ title, latitude, longitude, beforePhoto }) {
  const form = new FormData();
  form.append("title", title);
  form.append("latitude", latitude);
  form.append("longitude", longitude);
  form.append("before_photo", beforePhoto);

  const res = await http.post("/api/requests/", form);
  return res.data;
}

export async function assignWorker(id, worker_id) {
  const res = await http.post(`/api/requests/${id}/assign_worker/`, { worker_id });
  return res.data;
}
